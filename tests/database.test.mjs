import { PGlite } from "@electric-sql/pglite"
import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
const db = new PGlite()
await db.exec(`create role anon;create role authenticated;create role service_role;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean);create table storage.objects(bucket_id text);create table app_settings(key text primary key,value jsonb);
create table users(id uuid primary key default gen_random_uuid(),telegram_user_id bigint unique not null,customer_code text unique not null,name text not null,phone text not null,status text default 'active',onboarding_completed boolean default false,onboarding_step text default 'oferta' check(onboarding_step in ('oferta','phone','name','provider','region','branch','completed')),phone_verified_at timestamptz);
create table academy_courses(id text primary key,title text,active boolean default true);
create table academy_lessons(id text primary key,course_id text references academy_courses(id),duration_seconds int,"order" int);
create table academy_access(id uuid primary key default gen_random_uuid(),user_id uuid references users(id) on delete cascade,course_id text references academy_courses(id),status text,unique(user_id,course_id));
create table academy_user_progress(id uuid primary key default gen_random_uuid(),user_id uuid references users(id) on delete cascade,lesson_id text references academy_lessons(id),max_watched_seconds int,last_position_seconds int,completed boolean,last_sync_timestamp timestamptz,unique(user_id,lesson_id));
create table admin_audit_logs(id uuid);`)
const migration = await readFile(
  new URL("../supabase/migrations/0004_eucla_priority.sql", import.meta.url),
  "utf8",
)
await db.exec(migration)
const q = async (sql, args = []) => (await db.query(sql, args)).rows
const u = (
  await q(
    `insert into users(telegram_user_id,customer_code,name,phone) values(1,'YK_PENDING_1','Test','') returning id`,
  )
)[0].id
const docs = {
  phone: "+998900000000",
  first_name: "Test",
  last_name: "User",
  passport: "AA1234567",
  pinfl: "12345678901234",
  photo_front: "front",
  photo_back: "back",
  address: "Namangan",
  consented_at: new Date().toISOString(),
}
await q(
  `insert into cargo_applications(telegram_user_id,status,data) values(1,'pending',$1)`,
  [JSON.stringify(docs)],
)
const review = async () =>
  (await q(`select eucla_review(1,99,true) result`))[0].result
assert.equal((await review()).code, "YK1")
assert.equal((await review()).code, "YK1")
assert.equal(
  (await q(`select name from users where id=$1`, [u]))[0].name,
  "Test User",
)
await db.exec(migration)
assert.equal((await review()).code, "YK1")
await q(`delete from users where id=$1`, [u])
await q(
  `insert into users(telegram_user_id,customer_code,name,phone) values(2,'YK_PENDING_2','Next','')`,
)
await q(
  `insert into cargo_applications(telegram_user_id,status,data) values(2,'pending',$1)`,
  [JSON.stringify(docs)],
)
assert.equal(
  (await q(`select eucla_review(2,99,true) result`))[0].result.code,
  "YK2",
)
const user = (await q(`select id from users where telegram_user_id=2`))[0].id
await q(`insert into academy_courses values('course','Test',true)`)
await q(
  `insert into academy_lessons values('a','course',30,1),('b','course',20,2)`,
)
await assert.rejects(q(`select eucla_progress($1,'a',30,30)`, [user]), /access/)
await q(
  `insert into academy_access(user_id,course_id,status) values($1,'course','granted')`,
  [user],
)
await assert.rejects(
  q(`select eucla_progress($1,'b',20,20)`, [user]),
  /Previous/,
)
let result = (await q(`select eucla_progress($1,'a',30,30) result`, [user]))[0]
  .result
assert.equal(result.maxWatched, 12)
assert.equal(result.completed, false)
await q(
  `update academy_user_progress set last_sync_timestamp=now()-interval '10 seconds'`,
)
result = (await q(`select eucla_progress($1,'a',30,30) result`, [user]))[0]
  .result
assert.equal(result.completed, true)
result = (await q(`select eucla_progress($1,'a',0,0) result`, [user]))[0].result
assert.equal(result.completed, true)
assert.equal(result.maxWatched, 30)
assert.equal(
  (await q(`select eucla_progress($1,'b',0,0) result`, [user]))[0].result
    .completed,
  false,
)
await q(`update academy_access set status='pending'`)
await assert.rejects(q(`select eucla_progress($1,'a',30,30)`, [user]), /access/)
assert.equal((await q(`select eucla_claim_update(3) ok`))[0].ok, true)
assert.equal((await q(`select eucla_claim_update(3) ok`))[0].ok, false)
await q(`update bot_updates set status='failed' where update_id=3`)
assert.equal((await q(`select eucla_claim_update(3) ok`))[0].ok, true)
for (let i = 1; i <= 11; i++)
  assert.equal(
    (await q(`select eucla_login_attempt('test') ok`))[0].ok,
    i <= 10,
  )
console.log(
  "PASS: migration twice, sequential/repeated/deleted IDs, name persistence, paid gating, order gating, anti-skip, monotonic progress, revoked access, webhook replay/retry, login throttling.",
)
await db.exec(
  await readFile(
    new URL("../supabase/migrations/0005_yukla_telegram.sql", import.meta.url),
    "utf8",
  ),
)
await db.exec(
  await readFile(
    new URL("../supabase/migrations/0005_yukla_telegram.sql", import.meta.url),
    "utf8",
  ),
)
await q(`alter table academy_lessons add column title text default 'Dars'`)
await q(`delete from academy_user_progress`)
const key = (await q(`select bot_key from academy_lessons where id='a'`))[0]
  .bot_key
const keyB = (await q(`select bot_key from academy_lessons where id='b'`))[0]
  .bot_key
await assert.rejects(
  q(`select yukla_lesson_action($1,$2,false)`, [user, key]),
  /access/,
)
await q(`update academy_access set status='granted'`)
await assert.rejects(
  q(`select yukla_lesson_action($1,$2,true)`, [user, keyB]),
  /Previous/,
)
await assert.rejects(
  q(`select yukla_lesson_action($1,$2,true)`, [user, key]),
  /Video/,
)
const upload = (
  await q(
    `insert into bot_media_uploads(update_id,admin_tg,file_id,duration,file_size,choices) values(7,99,$1,3600,2147483648,'[{"id":"a"},{"id":"b"}]') returning id`,
    ["large-file-id-".repeat(40)],
  )
)[0].id
await assert.rejects(
  q(`select yukla_bind_video($1,12,'a')`, [upload]),
  /unavailable/,
)
await q(`select yukla_bind_video($1,99,'a')`, [upload])
await q(`select yukla_bind_video($1,99,'a')`, [upload])
await assert.rejects(
  q(`select yukla_bind_video($1,99,'b')`, [upload]),
  /Already/,
)
let video = (
  await q(`select yukla_lesson_action($1,$2,false) result`, [user, key])
)[0].result
assert.equal(video.telegram_file_size, 2147483648)
for (let i = 0; i < 3; i++)
  assert.equal(
    (await q(`select yukla_lesson_action($1,$2,true) result`, [user, key]))[0]
      .result.id,
    "b",
  )
assert.equal(
  (
    await q(
      `select count(*)::int n from academy_user_progress where user_id=$1`,
      [user],
    )
  )[0].n,
  1,
)
const progress = (
  await q(`select * from academy_user_progress where user_id=$1`, [user])
)[0]
assert.equal(progress.completed, true)
assert.equal(progress.completion_source, "telegram_confirmation")
assert.equal(progress.max_watched_seconds, 0)
assert.equal(
  (await q(`select yukla_lesson_action($1,$2,false) result`, [user, key]))[0]
    .result.id,
  "a",
)
await q(`update academy_access set status='pending'`)
await assert.rejects(
  q(`select yukla_lesson_action($1,$2,false)`, [user, key]),
  /access/,
)
await assert.rejects(
  q(`select yukla_lesson_action($1,$2,true)`, [user, key]),
  /access/,
)
assert.equal(
  (
    await q(
      `select has_function_privilege('anon','yukla_lesson_action(uuid,uuid,boolean)','EXECUTE') allowed`,
    )
  )[0].allowed,
  false,
)
assert.equal(
  (
    await q(
      `select has_table_privilege('authenticated','bot_media_uploads','SELECT') allowed`,
    )
  )[0].allowed,
  false,
)
console.log(
  "PASS: Telegram migration twice, 2GB metadata, binding owner, immutable repeat binding, prerequisite/revocation, repeated completion, replay lesson, confirmation source and SQL privileges.",
)
const saved = async (
  update,
  expectedStep,
  expectedStatus,
  step,
  status = "draft",
) =>
  (
    await q(`select yukla_save_application(3,$1,$2,$3,$4,'{}',$5) ok`, [
      update,
      expectedStep,
      expectedStatus,
      step,
      status,
    ])
  )[0].ok
assert.equal(await saved(100, null, null, "terms"), true)
assert.equal(await saved(101, "terms", "draft", "phone"), true)
assert.equal(await saved(101, "phone", "draft", "first_name"), true)
assert.equal(
  (await q(`select step from cargo_applications where telegram_user_id=3`))[0]
    .step,
  "phone",
)
assert.equal(await saved(102, "terms", "draft", "first_name"), false)
assert.equal(await saved(103, "phone", "draft", "confirm", "pending"), true)
assert.equal(await saved(104, "confirm", "pending", "terms"), false)
await q(
  `insert into users(telegram_user_id,customer_code,name,phone,onboarding_completed) values(4,'YK-104','Legacy','',true)`,
)
await q(
  `insert into cargo_applications(telegram_user_id,status,data) values(4,'pending',$1)`,
  [JSON.stringify(docs)],
)
assert.equal(
  (await q(`select eucla_review(4,99,true) result`))[0].result.code,
  "YK-104",
)
assert.equal(
  (
    await q(
      `select count(*)::int n from academy_access a join users u on u.id=a.user_id where u.telegram_user_id=4`,
    )
  )[0].n,
  0,
)
await q(`update bot_updates set status='done' where update_id=3`)
assert.equal((await q(`select eucla_claim_update(3) ok`))[0].ok, false)
console.log(
  "PASS: cargo replay/CAS/pending guard, legacy cargo ID preservation, approval does not grant courses, completed webhook replay.",
)
await q(`create sequence customer_code_seq start 500`);
await q(`select nextval('customer_code_seq')`);
await db.exec(await readFile(new URL('../supabase/migrations/0005_yukla_telegram.sql',import.meta.url),'utf8'));
assert.equal(Number((await q(`select nextval('eucla_customer_seq') n`))[0].n),501);
console.log('PASS: deleted historic allocations from the legacy sequence are not reused.');
await db.close()
