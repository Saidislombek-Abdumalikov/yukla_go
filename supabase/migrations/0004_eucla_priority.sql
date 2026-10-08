-- Run once in Supabase SQL Editor before deploying. Re-running preserves IDs.
create table if not exists public.cargo_applications (
 telegram_user_id bigint primary key, step text not null default 'terms',
 data jsonb not null default '{}', status text not null default 'draft'
 check(status in ('draft','pending','approved','rejected')),
 customer_code text, reviewed_by bigint, updated_at timestamptz not null default now()
);
create sequence if not exists public.eucla_customer_seq start 1;
do $$ declare n bigint; begin
 select greatest(coalesce(max(substring(customer_code from '^YK-?([0-9]+)$')::bigint),0)+1,
 (select last_value + case when is_called then 1 else 0 end from public.eucla_customer_seq)) into n from public.users;
 perform setval('public.eucla_customer_seq',n,false);
end $$;
create table if not exists public.bot_updates(update_id bigint primary key, status text not null, touched_at timestamptz not null default now());
create table if not exists public.admin_login_attempts(key text primary key, attempts int not null default 0, window_start timestamptz not null default now());
create or replace function public.eucla_login_attempt(p_key text) returns boolean language plpgsql security definer set search_path=public as $$
declare r admin_login_attempts; begin
 insert into admin_login_attempts(key,attempts) values(p_key,1)
 on conflict(key) do update set attempts=case when admin_login_attempts.window_start<now()-interval '15 minutes' then 1 else admin_login_attempts.attempts+1 end,
 window_start=case when admin_login_attempts.window_start<now()-interval '15 minutes' then now() else admin_login_attempts.window_start end returning * into r;
 return r.attempts<=10;
end $$;
create or replace function public.eucla_claim_update(p_id bigint) returns boolean language plpgsql security definer set search_path=public as $$
declare n int; begin
 insert into bot_updates values(p_id,'processing',now()) on conflict(update_id) do update set status='processing',touched_at=now()
 where bot_updates.status='failed' or (bot_updates.status='processing' and bot_updates.touched_at<now()-interval '2 minutes');
 get diagnostics n=row_count; return n>0;
end $$;
create or replace function public.eucla_review(p_tg bigint,p_admin bigint,p_approve boolean) returns jsonb language plpgsql security definer set search_path=public as $$
declare a cargo_applications; u users; c text; begin
 select * into a from cargo_applications where telegram_user_id=p_tg for update;
 if not found then raise exception 'Application not found';end if;
 if a.status='approved' then return jsonb_build_object('code',a.customer_code,'status',a.status);end if;
 if a.status<>'pending' then raise exception 'Application is not pending';end if;
 if not p_approve then update cargo_applications set status='rejected',reviewed_by=p_admin,updated_at=now() where telegram_user_id=p_tg;return jsonb_build_object('status','rejected');end if;
 if not (a.data ?& array['phone','first_name','last_name','passport','pinfl','photo_front','photo_back','address','consented_at']) then raise exception 'Incomplete documents';end if;
 select * into u from users where telegram_user_id=p_tg for update;
 if u.status='blocked' then raise exception 'User blocked';end if;
 if u.onboarding_completed and u.customer_code ~ '^YK[0-9]+$' then c=u.customer_code;else c='YK'||nextval('eucla_customer_seq');end if;
 update users set customer_code=c,name=a.data->>'first_name'||' '|| (a.data->>'last_name'),phone=a.data->>'phone',phone_verified_at=now(),onboarding_completed=true,onboarding_step='completed' where telegram_user_id=p_tg;
 if not found then raise exception 'User not found';end if;
 update cargo_applications set status='approved',customer_code=c,reviewed_by=p_admin,updated_at=now() where telegram_user_id=p_tg;
 return jsonb_build_object('code',c,'status','approved');end $$;
-- Serialize progress per user. Never trust a client completion flag.
create or replace function public.eucla_progress(p_user uuid,p_lesson text,p_position int,p_max int) returns jsonb language plpgsql security definer set search_path=public as $$
declare l academy_lessons; r academy_user_progress; cap int; target int; done boolean; begin
 perform 1 from users where id=p_user and status='active' for update;
 if not found then raise exception 'User unavailable';end if;
 select * into l from academy_lessons where id=p_lesson;
 if not found or l.duration_seconds<=0 then raise exception 'Invalid lesson duration';end if;
 if not exists(select 1 from academy_access where user_id=p_user and course_id=l.course_id and status='granted') then raise exception 'Course access required';end if;
 if not exists(select 1 from academy_courses where id=l.course_id and active) then raise exception 'Course unavailable';end if;
 if exists(select 1 from academy_lessons prev where prev.course_id=l.course_id and (prev."order",prev.id)<(l."order",l.id) and not exists(select 1 from academy_user_progress p where p.user_id=p_user and p.lesson_id=prev.id and p.completed)) then raise exception 'Previous lesson incomplete';end if;
 select * into r from academy_user_progress where user_id=p_user and lesson_id=p_lesson;
 -- Maximum 2x playback; cap offline jumps to 35 seconds.
 cap=case when r.id is null then 12 else least(35,greatest(0,floor(extract(epoch from (now()-r.last_sync_timestamp))*2)::int)+3) end;
 target=greatest(coalesce(r.max_watched_seconds,0),least(l.duration_seconds,greatest(0,p_max),coalesce(r.max_watched_seconds,0)+cap));
 done=coalesce(r.completed,false) or target>=greatest(1,l.duration_seconds-1);
 insert into academy_user_progress(user_id,lesson_id,max_watched_seconds,last_position_seconds,completed,last_sync_timestamp)
 values(p_user,p_lesson,target,least(target,greatest(0,p_position)),done,now())
 on conflict(user_id,lesson_id) do update set max_watched_seconds=excluded.max_watched_seconds,last_position_seconds=excluded.last_position_seconds,completed=excluded.completed,last_sync_timestamp=now() returning * into r;
 return jsonb_build_object('current',r.last_position_seconds,'maxWatched',r.max_watched_seconds,'completed',r.completed);
end $$;
alter table cargo_applications enable row level security;
alter table bot_updates enable row level security;
alter table admin_login_attempts enable row level security;
revoke all on cargo_applications,bot_updates,admin_login_attempts from anon,authenticated;
revoke all on function eucla_review(bigint,bigint,boolean),eucla_progress(uuid,text,int,int),eucla_claim_update(bigint),eucla_login_attempt(text) from public,anon,authenticated;
grant execute on function eucla_review(bigint,bigint,boolean),eucla_progress(uuid,text,int,int),eucla_claim_update(bigint),eucla_login_attempt(text) to service_role;
-- These records are accessed only through the authenticated server.
revoke all on users,academy_access,academy_user_progress,academy_lessons,academy_courses,admin_audit_logs from anon,authenticated;
-- Make the existing lesson bucket private; new signed uploads use the same bucket.
insert into storage.buckets(id,name,public) values('videos','videos',false)
on conflict(id) do update set public=false;
-- Even if a previous broad storage policy exists, clients cannot bypass video signing.
drop policy if exists eucla_private_videos on storage.objects;
create policy eucla_private_videos on storage.objects as restrictive for all to anon,authenticated
using (bucket_id <> 'videos') with check (bucket_id <> 'videos');
revoke all on app_settings from anon,authenticated;
grant all on cargo_applications,bot_updates,admin_login_attempts to service_role;
grant usage,select on sequence eucla_customer_seq to service_role;
