/**
 * ==============================================================================
 * YUKLA GO ACADEMY STORE (Supabase is the single source of truth)
 * ==============================================================================
 * Nothing here is kept in server memory: every function reads/writes the
 * database, so it behaves the same on Vercel serverless as anywhere else.
 */
import type { Course, Lesson, UserLessonProgress, StudentProgressSummary, CourseAccessItem, CourseAccessStatus } from '../../types';
import { getSupabase } from './supabase.ts';

export class StoreError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const DEFAULT_COURSE_ID = 'course_cargo_101';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function db() {
  const supabase = getSupabase();
  if (!supabase) throw new StoreError('Ma\'lumotlar bazasi sozlanmagan', 503);
  return supabase;
}

function check<T>(res: { data: T; error: any }): T {
  if (res.error) {
    console.error('Academy DB error:', res.error.message || res.error);
    throw new StoreError('Ma\'lumotlar bazasida xatolik', 500);
  }
  return res.data;
}

export function assertId(value: unknown, label = 'ID'): string {
  const v = String(value ?? '');
  if (!ID_RE.test(v)) throw new StoreError(`${label} noto'g'ri`, 400);
  return v;
}

// -----------------------------------------------------------------------------
// Users
// -----------------------------------------------------------------------------
export interface DbUser {
  id: string;
  name: string;
  customerCode: string;
  telegramUserId: number;
  status: string;
}

function mapUser(u: any): DbUser {
  return {
    id: u.id,
    name: u.name || 'Mijoz',
    customerCode: u.customer_code || '',
    telegramUserId: Number(u.telegram_user_id),
    status: u.status || 'active',
  };
}

/** Loads the user behind a session. Throws 401 if missing, 403 if blocked. */
export async function getActiveUser(userId: string, telegramUserId: number): Promise<DbUser> {
  if (!UUID_RE.test(userId)) throw new StoreError('Sessiya yaroqsiz, qayta kiring', 401);
  const row = check(await db().from('users').select('id, name, customer_code, telegram_user_id, status').eq('id', userId).maybeSingle());
  if (!row || Number(row.telegram_user_id) !== Number(telegramUserId)) {
    throw new StoreError('Foydalanuvchi topilmadi', 401);
  }
  if (row.status === 'blocked') throw new StoreError('Hisobingiz bloklangan', 403);
  return mapUser(row);
}

/** Admin helper: find a user by Telegram ID, customer code (YK-xxx), UUID or name. */
export async function resolveUser(identifier: string): Promise<DbUser | null> {
  const clean = String(identifier || '').trim().slice(0, 80);
  if (!clean) return null;
  const cols = 'id, name, customer_code, telegram_user_id, status';
  const num = Number(clean);
  let q = db().from('users').select(cols);
  if (UUID_RE.test(clean)) q = q.eq('id', clean);
  else if (Number.isInteger(num) && num > 100000) q = q.eq('telegram_user_id', num);
  else if (/^YK-/i.test(clean)) q = q.eq('customer_code', clean.toUpperCase());
  else q = q.ilike('name', `%${clean.replace(/[%_\\]/g, '')}%`).limit(1);
  const rows = check(await q);
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row ? mapUser(row) : null;
}

// -----------------------------------------------------------------------------
// Access control
// -----------------------------------------------------------------------------
export async function getAccessStatus(userId: string, courseId: string): Promise<CourseAccessStatus> {
  const row = check(
    await db().from('academy_access').select('status').eq('user_id', userId).eq('course_id', courseId).maybeSingle()
  );
  return (row?.status as CourseAccessStatus) || 'none';
}

export async function requestAccess(user: DbUser, courseId: string): Promise<CourseAccessItem> {
  const course = check(await db().from('academy_courses').select('id').eq('id', courseId).maybeSingle());
  if (!course) throw new StoreError('Kurs topilmadi', 404);
  const current = await getAccessStatus(user.id, courseId);
  const requestedAt = new Date().toISOString();
  if (current === 'none') {
    check(await db().from('academy_access').upsert(
      { user_id: user.id, course_id: courseId, status: 'pending', requested_at: requestedAt },
      { onConflict: 'user_id,course_id' }
    ));
  }
  return {
    userId: user.id,
    customerCode: user.customerCode,
    name: user.name,
    telegramUserId: user.telegramUserId,
    courseId,
    status: current === 'none' ? 'pending' : current,
    requestedAt,
  };
}

export async function grantAccess(user: DbUser, courseId: string, adminTelegramId: number): Promise<CourseAccessItem> {
  const course = check(await db().from('academy_courses').select('id').eq('id', courseId).maybeSingle());
  if (!course) throw new StoreError('Kurs topilmadi', 404);
  const grantedAt = new Date().toISOString();
  check(await db().from('academy_access').upsert(
    { user_id: user.id, course_id: courseId, status: 'granted', granted_at: grantedAt, granted_by: adminTelegramId },
    { onConflict: 'user_id,course_id' }
  ));
  return {
    userId: user.id,
    customerCode: user.customerCode,
    name: user.name,
    telegramUserId: user.telegramUserId,
    courseId,
    status: 'granted',
    grantedAt,
  };
}

export async function revokeAccess(user: DbUser, courseId: string): Promise<CourseAccessItem> {
  check(await db().from('academy_access').delete().eq('user_id', user.id).eq('course_id', courseId));
  return {
    userId: user.id,
    customerCode: user.customerCode,
    name: user.name,
    telegramUserId: user.telegramUserId,
    courseId,
    status: 'none',
  };
}

export async function listAccess(courseId: string): Promise<CourseAccessItem[]> {
  const users = check(
    await db().from('users').select('id, name, customer_code, telegram_user_id, status').order('created_at', { ascending: false }).limit(2000)
  ) as any[];
  const rows = check(
    await db().from('academy_access').select('user_id, status, granted_at, requested_at').eq('course_id', courseId)
  ) as any[];
  const byUser = new Map(rows.map(r => [r.user_id, r]));
  return users.map(u => {
    const r = byUser.get(u.id);
    return {
      userId: u.id,
      customerCode: u.customer_code || '',
      name: u.name || 'Mijoz',
      telegramUserId: Number(u.telegram_user_id),
      courseId,
      status: (r?.status as CourseAccessStatus) || 'none',
      grantedAt: r?.granted_at || undefined,
      requestedAt: r?.requested_at || undefined,
    };
  });
}

// -----------------------------------------------------------------------------
// Courses & lessons (student view)
// -----------------------------------------------------------------------------
export async function listCoursesForUser(userId: string): Promise<Course[]> {
  const courses = check(
    await db().from('academy_courses').select('*').eq('active', true).order('order', { ascending: true })
  ) as any[];
  const lessons = check(await db().from('academy_lessons').select('id, course_id')) as any[];
  const progress = check(
    await db().from('academy_user_progress').select('lesson_id, completed').eq('user_id', userId).eq('completed', true)
  ) as any[];
  const done = new Set(progress.map(p => p.lesson_id));
  return courses.map(c => {
    const own = lessons.filter(l => l.course_id === c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description || '',
      category: c.category,
      icon: c.icon || '📚',
      order: c.order,
      lessonsCount: own.length,
      completedLessonsCount: own.filter(l => done.has(l.id)).length,
    };
  });
}

/**
 * Lessons with sequential locking. The YouTube video ID is ONLY included for
 * lessons the student is currently allowed to watch.
 */
export async function getLessonsForUser(userId: string, courseId: string): Promise<Lesson[]> {
  const lessons = check(
    await db().from('academy_lessons')
      .select('*')
      .eq('course_id', courseId).order('order', { ascending: true })
  ) as any[];
  const ids = lessons.map(l => l.id);
  const progress = ids.length
    ? (check(await db().from('academy_user_progress')
        .select('lesson_id, max_watched_seconds, last_position_seconds, completed')
        .eq('user_id', userId).in('lesson_id', ids)) as any[])
    : [];
  const byLesson = new Map(progress.map(p => [p.lesson_id, p]));

  let previousCompleted = true;
  return lessons.map(l => {
    const rec = byLesson.get(l.id);
    const isCompleted = rec?.completed === true;
    const isLocked = !previousCompleted;
    previousCompleted = isCompleted;
    return {
      id: l.id,
      courseId: l.course_id,
      order: l.order,
      title: l.title,
      description: l.description || '',
      youtubeVideoId: isLocked ? '' : l.youtube_video_id,
      durationSeconds: l.duration_seconds,
      isLocked,
      isCompleted,
      maxWatchedSeconds: rec?.max_watched_seconds || 0,
      lastPositionSeconds: rec?.last_position_seconds || 0,
    };
  });
}

export async function recordProgress(
  user: DbUser,
  lessonId: string,
  reportedSeconds: number,
  clientReportedCompleted = false,
  bypassAccess = false
): Promise<{ success: boolean; progress: UserLessonProgress; unlockedNextLesson: boolean }> {
  assertId(lessonId, 'lessonId');
  if (!Number.isFinite(reportedSeconds)) throw new StoreError('watchedSeconds noto\'g\'ri', 400);

  const lesson = check(
    await db().from('academy_lessons').select('id, course_id, duration_seconds').eq('id', lessonId).maybeSingle()
  ) as any;
  if (!lesson) throw new StoreError('Dars topilmadi', 404);

  // Must have access to the course AND the lesson must be unlocked
  if (!bypassAccess && (await getAccessStatus(user.id, lesson.course_id)) !== 'granted') {
    throw new StoreError('Ushbu kursga ruxsat yo\'q', 403);
  }
  const lessons = await getLessonsForUser(user.id, lesson.course_id);
  const target = lessons.find(l => l.id === lessonId);
  if (!target || target.isLocked) throw new StoreError('Bu dars hali ochilmagan', 403);

  const existing = check(
    await db().from('academy_user_progress')
      .select('max_watched_seconds, completed, last_sync_timestamp')
      .eq('user_id', user.id).eq('lesson_id', lessonId).maybeSingle()
  ) as any;

  const now = Date.now();
  const duration = lesson.duration_seconds as number;
  let maxWatched = existing?.max_watched_seconds || 0;
  const lastSync = existing?.last_sync_timestamp ? new Date(existing.last_sync_timestamp).getTime() : now - 5000;
  const elapsedRealSec = Math.max(1, (now - lastSync) / 1000);

  // Anti-skip: cannot jump further than real elapsed time allows
  const allowedMaxJump = Math.max(15, elapsedRealSec * 1.5 + 10);
  const targetWatched = Math.max(0, Math.min(reportedSeconds, duration));
  if (targetWatched > maxWatched) {
    maxWatched = targetWatched - maxWatched > allowedMaxJump && !existing?.completed
      ? Math.min(duration, maxWatched + allowedMaxJump)
      : targetWatched;
  }

  const wasCompleted = existing?.completed === true;
  const isCompleted =
    wasCompleted ||
    maxWatched >= duration * 0.95 ||
    (clientReportedCompleted && maxWatched >= duration * 0.85);

  const row = {
    user_id: user.id,
    lesson_id: lessonId,
    max_watched_seconds: Math.floor(maxWatched),
    last_position_seconds: Math.floor(targetWatched),
    completed: isCompleted,
    last_sync_timestamp: new Date(now).toISOString(),
  };
  check(await db().from('academy_user_progress').upsert(row, { onConflict: 'user_id,lesson_id' }));

  return {
    success: true,
    progress: {
      userId: user.id,
      lessonId,
      maxWatchedSeconds: row.max_watched_seconds,
      lastPositionSeconds: row.last_position_seconds,
      completed: isCompleted,
      updatedAt: row.last_sync_timestamp,
    },
    unlockedNextLesson: isCompleted && !wasCompleted,
  };
}

// -----------------------------------------------------------------------------
// Admin: content management
// -----------------------------------------------------------------------------
export function extractYouTubeId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (match?.[1]) return match[1];
  return '';
}

export async function getCourseTitle(courseId: string): Promise<string | null> {
  const row = check(await db().from('academy_courses').select('title').eq('id', courseId).maybeSingle()) as any;
  return row?.title || null;
}

export async function listAllContent() {
  const courses = check(
    await db().from('academy_courses').select('*').order('order', { ascending: true })
  ) as any[];
  const lessons = check(
    await db().from('academy_lessons')
      .select('*').order('order', { ascending: true })
  ) as any[];
  return {
    courses: courses.map(c => ({ ...c, description: c.description || '' })),
    lessons: lessons.map(l => ({
      id: l.id, courseId: l.course_id, order: l.order, title: l.title,
      description: l.description || '', youtubeVideoId: l.youtube_video_id, durationSeconds: l.duration_seconds,
    })),
  };
}

const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export async function addCourse(data: { title: string; description?: string; icon?: string; category?: string }): Promise<Course> {
  const title = String(data.title || '').trim().slice(0, 150);
  if (!title) throw new StoreError('Bo\'lim nomi talab qilinadi', 400);
  const existing = check(await db().from('academy_courses').select('*')) as any[];
  const order = existing.reduce((m, c) => Math.max(m, c.order || 0), 0) + 1;
  const course = {
    id: `course_${rid()}`,
    title,
    description: String(data.description || '').trim().slice(0, 1000),
    icon: String(data.icon || '📚').trim().slice(0, 8),
    category: String(data.category || 'general').trim().slice(0, 40),
    order,
  };
  check(await db().from('academy_courses').insert(course));
  return course;
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  assertId(courseId, 'courseId');
  const found = check(await db().from('academy_courses').select('id').eq('id', courseId).maybeSingle());
  if (!found) return false;
  check(await db().from('academy_courses').delete().eq('id', courseId));
  return true;
}

export async function addLesson(
  courseId: string,
  data: { title: string; youtubeUrlOrId: string; durationSeconds?: number; description?: string }
) {
  assertId(courseId, 'courseId');
  const course = check(await db().from('academy_courses').select('id').eq('id', courseId).maybeSingle());
  if (!course) throw new StoreError('Kurs topilmadi', 404);
  const videoId = extractYouTubeId(data.youtubeUrlOrId);
  if (!videoId) throw new StoreError('YouTube havolasi yoki video ID noto\'g\'ri', 400);
  const title = String(data.title || '').trim().slice(0, 200);
  if (!title) throw new StoreError('Dars nomi talab qilinadi', 400);
  const duration = Math.min(86400, Math.max(10, Math.floor(Number(data.durationSeconds) || 360)));

  const existing = check(await db().from('academy_lessons').select('*').eq('course_id', courseId)) as any[];
  const order = existing.reduce((m, l) => Math.max(m, l.order || 0), 0) + 1;
  const row = {
    id: `les_${rid()}`,
    course_id: courseId,
    order,
    title,
    description: String(data.description || '').trim().slice(0, 2000),
    youtube_video_id: videoId,
    duration_seconds: duration,
  };
  check(await db().from('academy_lessons').insert(row));
  return { id: row.id, courseId, order, title, description: row.description, youtubeVideoId: videoId, durationSeconds: duration };
}

export async function deleteLesson(lessonId: string): Promise<boolean> {
  assertId(lessonId, 'lessonId');
  const found = check(await db().from('academy_lessons').select('id').eq('id', lessonId).maybeSingle());
  if (!found) return false;
  check(await db().from('academy_lessons').delete().eq('id', lessonId));
  return true;
}

// -----------------------------------------------------------------------------
// Admin: students & progress
// -----------------------------------------------------------------------------
export async function studentsSummary(courseId: string): Promise<StudentProgressSummary[]> {
  const lessons = check(
    await db().from('academy_lessons').select('*').eq('course_id', courseId).order('order', { ascending: true })
  ) as any[];
  const access = check(await db().from('academy_access').select('user_id').eq('course_id', courseId).eq('status', 'granted')) as any[];
  const ids = access.map(a => a.user_id);
  if (!ids.length) return [];
  const users = check(await db().from('users').select('id, name, customer_code').in('id', ids)) as any[];
  const lessonIds = lessons.map(l => l.id);
  const progress = lessonIds.length
    ? (check(await db().from('academy_user_progress')
        .select('user_id, lesson_id, max_watched_seconds, completed').in('user_id', ids).in('lesson_id', lessonIds)) as any[])
    : [];

  return users.map(u => {
    let completedCount = 0;
    const detail = lessons.map(l => {
      const rec = progress.find(p => p.user_id === u.id && p.lesson_id === l.id);
      const completed = rec?.completed === true;
      if (completed) completedCount++;
      const maxW = rec?.max_watched_seconds || 0;
      const pct = Math.min(100, Math.round((maxW / (l.duration_seconds || 1)) * 100));
      return {
        lessonId: l.id, title: l.title, order: l.order, completed, isCompleted: completed,
        watchedPercent: pct, percentage: pct, durationSeconds: l.duration_seconds, maxWatchedSeconds: maxW,
      };
    });
    const total = lessons.length;
    const pct = total ? Math.round((completedCount / total) * 100) : 0;
    return {
      userId: u.id, name: u.name || 'Mijoz', customerCode: u.customer_code || '',
      completedCount, completedLessonsCount: completedCount, totalLessons: total,
      progressPercent: pct, completionPercentage: pct, lessons: detail,
    };
  });
}

export async function resetProgress(userId: string, courseId?: string): Promise<void> {
  if (!UUID_RE.test(userId)) throw new StoreError('userId noto\'g\'ri', 400);
  if (courseId) {
    const lessons = check(await db().from('academy_lessons').select('id').eq('course_id', courseId)) as any[];
    const ids = lessons.map(l => l.id);
    if (ids.length) check(await db().from('academy_user_progress').delete().eq('user_id', userId).in('lesson_id', ids));
  } else {
    check(await db().from('academy_user_progress').delete().eq('user_id', userId));
  }
}
