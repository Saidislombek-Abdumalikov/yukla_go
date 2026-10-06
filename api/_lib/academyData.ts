/**
 * ==============================================================================
 * YUKLA GO ACADEMY - VIDEO LESSONS & PROGRESS ENGINE
 * ==============================================================================
 * Reusable Course Engine supporting sequential video lessons, anti-forward-seek
 * enforcement, server-side progress jump protection, and student tracking.
 */

import type { Course, Lesson, UserLessonProgress, StudentProgressSummary, CourseAccessItem, CourseAccessStatus } from '../../types';
import { getSupabase } from './supabase.ts';

export interface StoredLesson {
  id: string;
  courseId: string;
  order: number;
  title: string;
  description: string;
  youtubeVideoId: string;
  durationSeconds: number;
}

export const INITIAL_COURSES: Course[] = [
  {
    id: 'course_cargo_101',
    title: 'Xitoydan buyurtma berish kursi',
    description: 'Xitoy saytlaridan (Taobao, 1688, Pinduoduo) mustaqil xarid qilish va O\'zbekistonga tez yetkazib berish bo\'yicha to\'liq qo\'llanma.',
    category: 'cargo',
    icon: '📦',
    order: 1,
  },
];

export let STORED_COURSES: Course[] = [...INITIAL_COURSES];

/**
 * Admin action: Add new course / section (Bo'lim)
 */
export function addCourse(data: {
  title: string;
  description?: string;
  icon?: string;
  category?: string;
}): Course {
  const newCourse: Course = {
    id: `course_${Date.now()}`,
    title: data.title.trim(),
    description: data.description?.trim() || '',
    icon: data.icon?.trim() || '📚',
    category: data.category || 'general',
    order: STORED_COURSES.length + 1,
  };
  STORED_COURSES.push(newCourse);
  return newCourse;
}

/**
 * Admin action: Delete course and its associated lessons
 */
export function deleteCourse(courseId: string): boolean {
  const idx = STORED_COURSES.findIndex(c => c.id === courseId);
  if (idx === -1) return false;
  STORED_COURSES.splice(idx, 1);
  STORED_LESSONS = STORED_LESSONS.filter(l => l.courseId !== courseId);
  return true;
}

export let STORED_LESSONS: StoredLesson[] = [
  // ---------------------------------------------------------------------------
  // Primary Course: Cargo Academy Lessons
  // ---------------------------------------------------------------------------
  {
    id: 'les_c1_1',
    courseId: 'course_cargo_101',
    order: 1,
    title: '1. Kirish: Xitoy karqo qanday ishlaydi?',
    description: 'Aviakargo va avtokargo farqlari, bojxona qoidalari va mijoz kodi (YK-###) mohiyati.',
    youtubeVideoId: 'M7lc1UVf-VE',
    durationSeconds: 360,
  },
  {
    id: 'les_c1_2',
    courseId: 'course_cargo_101',
    order: 2,
    title: '2. Taobao va 1688 ilovalarida ro\'yxatdan o\'tish',
    description: 'Alipay hamyonini ulash, akkaunt xavfsizligi va blokdan saqlanish usullari.',
    youtubeVideoId: 'jNQXAC9IVRw',
    durationSeconds: 480,
  },
  {
    id: 'les_c1_3',
    courseId: 'course_cargo_101',
    order: 3,
    title: '3. Xitoy ombor manzilini to\'g\'ri kiritish (YK-###)',
    description: 'Yukla Go ombor manzilini Taobao ilovasiga bir martalik nusxa orqali avtomatik joylash.',
    youtubeVideoId: '21X5lGlDOfg',
    durationSeconds: 420,
  },
  {
    id: 'les_c1_4',
    courseId: 'course_cargo_101',
    order: 4,
    title: '4. To\'lov qilish va mahsulot sifatini tekshirish',
    description: 'Sotuvchi reytingi, mijozlar sharhlari va xavfsiz to\'lov tizimi.',
    youtubeVideoId: 'L_LUpnjgPso',
    durationSeconds: 540,
  },
  {
    id: 'les_c1_5',
    courseId: 'course_cargo_101',
    order: 5,
    title: '5. Trek kodini kiritish va O\'zbekistonda qabul qilish',
    description: 'Yukni O\'zbekistonga yetib kelguncha kuzatish va belgilangan filialdan qabul qilib olish.',
    youtubeVideoId: 'fJ9rUzIMcZQ',
    durationSeconds: 390,
  },
];

interface ProgressRecord {
  userId: string;
  lessonId: string;
  maxWatchedSeconds: number;
  lastPositionSeconds: number;
  completed: boolean;
  lastSyncTimestamp: number;
  updatedAt: string;
}

// In-memory progress store keyed by `userId:lessonId`
const progressStore = new Map<string, ProgressRecord>();

/**
 * Extract clean 11-char YouTube video ID from any link format or plain ID.
 * Supports:
 * - standard watch: youtube.com/watch?v=ID
 * - short link: youtu.be/ID
 * - embed: youtube.com/embed/ID
 * - shorts: youtube.com/shorts/ID
 * - live stream: youtube.com/live/ID
 * - mobile/subdomain: m.youtube.com/watch?v=ID
 * - with query params (t=, si=, feature=, etc.)
 */
export function extractYouTubeId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // 1. If already a clean 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  // 2. Comprehensive regex matching standard, shorts, live, embed, and share links
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (match && match[1]) return match[1];

  // 3. Fallback search for any 11-char sequence after v= or trailing slash
  const fallback = trimmed.match(/(?:[?&]v=|\/)([a-zA-Z0-9_-]{11})(?:[?&/#]|$)/);
  if (fallback && fallback[1]) return fallback[1];

  return trimmed;
}

/**
 * Get all courses with progress count for a given user
 */
export function getCoursesWithUserProgress(userId: string): Course[] {
  return STORED_COURSES.map(course => {
    const courseLessons = STORED_LESSONS.filter(l => l.courseId === course.id);
    const completedCount = courseLessons.filter(l => {
      const rec = progressStore.get(`${userId}:${l.id}`);
      return rec?.completed === true;
    }).length;

    return {
      ...course,
      lessonsCount: courseLessons.length,
      completedLessonsCount: completedCount,
    };
  });
}

/**
 * Get lessons for a course with sequential lock calculation
 */
export function getCourseLessonsForUser(userId: string, courseId: string): Lesson[] {
  const courseLessons = STORED_LESSONS
    .filter(l => l.courseId === courseId)
    .sort((a, b) => a.order - b.order);

  let previousCompleted = true; // Lesson 1 is always unlocked

  return courseLessons.map(l => {
    const rec = progressStore.get(`${userId}:${l.id}`);
    const isCompleted = rec?.completed === true;
    const isLocked = !previousCompleted;

    const maxWatched = rec?.maxWatchedSeconds || 0;
    const lastPos = rec?.lastPositionSeconds || 0;

    // Next lesson only unlocks if this lesson is completed
    previousCompleted = isCompleted;

    return {
      id: l.id,
      courseId: l.courseId,
      order: l.order,
      title: l.title,
      description: l.description,
      youtubeVideoId: l.youtubeVideoId,
      durationSeconds: l.durationSeconds,
      isLocked,
      isCompleted,
      maxWatchedSeconds: maxWatched,
      lastPositionSeconds: lastPos,
    };
  });
}

/**
 * Update user watched progress with strict jump validation
 */
export function recordUserLessonProgress(
  userId: string,
  lessonId: string,
  reportedSeconds: number,
  clientReportedCompleted: boolean = false,
  bypassJumpProtection: boolean = false
): { success: boolean; progress: UserLessonProgress; unlockedNextLesson: boolean } {
  const lesson = STORED_LESSONS.find(l => l.id === lessonId);
  if (!lesson) {
    throw new Error('Dars topilmadi');
  }

  const key = `${userId}:${lessonId}`;
  const now = Date.now();
  const existing = progressStore.get(key);

  let maxWatched = existing ? existing.maxWatchedSeconds : 0;
  const oldLastSync = existing ? existing.lastSyncTimestamp : now - 5000;
  const elapsedRealSec = Math.max(1, (now - oldLastSync) / 1000);

  // Jump protection: cannot jump more than elapsedRealSec * 1.5 + 15 seconds forward
  const allowedMaxJump = Math.max(15, elapsedRealSec * 1.5 + 10);
  const targetWatched = Math.max(0, Math.min(reportedSeconds, lesson.durationSeconds));

  if (targetWatched > maxWatched) {
    if (!bypassJumpProtection && targetWatched - maxWatched > allowedMaxJump && !existing?.completed) {
      // Clamped jump
      maxWatched = Math.min(lesson.durationSeconds, maxWatched + allowedMaxJump);
    } else {
      maxWatched = targetWatched;
    }
  }

  // Completed check: reached 95% of video duration or completed flag with at least 90%
  const isCompleted = existing?.completed ||
    maxWatched >= lesson.durationSeconds * 0.95 ||
    (clientReportedCompleted && maxWatched >= lesson.durationSeconds * 0.85);

  const updatedRec: ProgressRecord = {
    userId,
    lessonId,
    maxWatchedSeconds: Math.floor(maxWatched),
    lastPositionSeconds: Math.floor(targetWatched),
    completed: isCompleted,
    lastSyncTimestamp: now,
    updatedAt: new Date(now).toISOString(),
  };

  const wasCompletedBefore = existing?.completed === true;
  progressStore.set(key, updatedRec);

  return {
    success: true,
    progress: {
      userId,
      lessonId,
      maxWatchedSeconds: updatedRec.maxWatchedSeconds,
      lastPositionSeconds: updatedRec.lastPositionSeconds,
      completed: updatedRec.completed,
      updatedAt: updatedRec.updatedAt,
    },
    unlockedNextLesson: isCompleted && !wasCompletedBefore,
  };
}

/**
 * Get summary of student progress across a course
 */
export function getStudentsProgressSummary(users: { id: string; name: string; customerCode: string }[], courseId: string = 'course_cargo_101'): StudentProgressSummary[] {
  const courseLessons = STORED_LESSONS.filter(l => l.courseId === courseId).sort((a, b) => a.order - b.order);
  const total = courseLessons.length;

  return users.map(user => {
    let completedCount = 0;
    const lessonsDetail = courseLessons.map(l => {
      const rec = progressStore.get(`${user.id}:${l.id}`);
      const isComp = rec?.completed === true;
      if (isComp) completedCount++;
      const maxW = rec?.maxWatchedSeconds || 0;
      const watchedPercent = Math.min(100, Math.round((maxW / (l.durationSeconds || 1)) * 100));

      return {
        lessonId: l.id,
        title: l.title,
        order: l.order,
        completed: isComp,
        isCompleted: isComp,
        watchedPercent,
        percentage: watchedPercent,
        durationSeconds: l.durationSeconds,
        maxWatchedSeconds: maxW,
      };
    });

    const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return {
      userId: user.id,
      name: user.name,
      customerCode: user.customerCode,
      completedCount,
      completedLessonsCount: completedCount,
      totalLessons: total,
      progressPercent: pct,
      completionPercentage: pct,
      lessons: lessonsDetail,
    };
  });
}

/**
 * Admin action: reset progress for a student
 */
export function resetStudentProgress(userId: string, courseId?: string) {
  const lessonsToReset = courseId
    ? STORED_LESSONS.filter(l => l.courseId === courseId)
    : STORED_LESSONS;

  for (const l of lessonsToReset) {
    progressStore.delete(`${userId}:${l.id}`);
  }
  return true;
}

/**
 * Admin action: Add new lesson to course
 */
export function addLessonToCourse(courseId: string, data: { title: string; youtubeUrlOrId: string; order?: number; durationSeconds?: number; description?: string }): StoredLesson {
  const videoId = extractYouTubeId(data.youtubeUrlOrId);
  const courseLessons = STORED_LESSONS.filter(l => l.courseId === courseId);
  const nextOrder = data.order || (courseLessons.length + 1);

  const newLesson: StoredLesson = {
    id: `les_${courseId.slice(7, 10)}_${Date.now()}`,
    courseId,
    order: nextOrder,
    title: data.title.trim(),
    description: data.description?.trim() || '',
    youtubeVideoId: videoId,
    durationSeconds: data.durationSeconds || 360,
  };

  STORED_LESSONS.push(newLesson);
  return newLesson;
}

/**
 * Admin action: Delete lesson
 */
export function deleteLesson(lessonId: string): boolean {
  const idx = STORED_LESSONS.findIndex(l => l.id === lessonId);
  if (idx !== -1) {
    STORED_LESSONS.splice(idx, 1);
    return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Course Access & Permissions Management
// -----------------------------------------------------------------------------
// Course Access & Permissions Management
// -----------------------------------------------------------------------------
export const DEMO_ACADEMY_USERS: Array<{
  id: string;
  name: string;
  customerCode: string;
  telegramUserId?: number;
}> = [];

const courseAccessStore = new Map<string, CourseAccessItem>();

const ADMIN_TELEGRAM_IDS = [7232597769, 5059829001];

let isAccessStoreLoaded = false;

export async function ensureAcademyAccessLoaded(forceRefresh: boolean = false): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  if (isAccessStoreLoaded && !forceRefresh) return;

  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'academy_access_records')
      .maybeSingle();

    if (data?.value?.records && Array.isArray(data.value.records)) {
      for (const item of data.value.records) {
        courseAccessStore.set(`${item.userId}:${item.courseId}`, item);
        if (!DEMO_ACADEMY_USERS.some(u => u.id === item.userId)) {
          DEMO_ACADEMY_USERS.push({
            id: item.userId,
            name: item.name || 'Mijoz',
            customerCode: item.customerCode || 'YK-???',
            telegramUserId: item.telegramUserId || 0,
          });
        }
      }
    }
    isAccessStoreLoaded = true;
  } catch {
    // Ignore
  }
}

export async function saveCourseAccessToSupabase(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const allRecords = Array.from(courseAccessStore.values());
    await supabase.from('app_settings').upsert({
      key: 'academy_access_records',
      value: { records: allRecords },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  } catch (err) {
    console.error('Failed to persist academy access records:', err);
  }
}

export function hasUserCourseAccess(
  userId: string,
  courseId: string,
  context?: { telegramUserId?: number; customerCode?: string }
): boolean {
  // Administrators always have full access to all courses
  const numericId = Number(userId) || (context?.telegramUserId ? Number(context.telegramUserId) : 0);
  if (numericId && ADMIN_TELEGRAM_IDS.includes(numericId)) {
    return true;
  }

  // Check 1: direct key match
  const directRecord = courseAccessStore.get(`${userId}:${courseId}`);
  if (directRecord?.status === 'granted') {
    return true;
  }

  // Check 2: scan courseAccessStore by alternative identifiers
  const cleanCode = context?.customerCode?.trim().toUpperCase();
  const tgId = context?.telegramUserId;

  for (const item of courseAccessStore.values()) {
    if (item.courseId === courseId && item.status === 'granted') {
      if (item.userId === userId) return true;
      if (cleanCode && item.customerCode?.trim().toUpperCase() === cleanCode) return true;
      if (tgId && item.telegramUserId === tgId) return true;
      if (numericId && item.telegramUserId === numericId) return true;
    }
  }

  return false;
}

export function getUserCourseAccessStatus(
  userId: string,
  courseId: string,
  context?: { telegramUserId?: number; customerCode?: string }
): CourseAccessStatus {
  const numericId = Number(userId) || (context?.telegramUserId ? Number(context.telegramUserId) : 0);
  if (numericId && ADMIN_TELEGRAM_IDS.includes(numericId)) {
    return 'granted';
  }

  const directRecord = courseAccessStore.get(`${userId}:${courseId}`);
  if (directRecord?.status) {
    return directRecord.status;
  }

  const cleanCode = context?.customerCode?.trim().toUpperCase();
  const tgId = context?.telegramUserId;

  for (const item of courseAccessStore.values()) {
    if (item.courseId === courseId) {
      if (item.userId === userId) return item.status;
      if (cleanCode && item.customerCode?.trim().toUpperCase() === cleanCode) return item.status;
      if (tgId && item.telegramUserId === tgId) return item.status;
      if (numericId && item.telegramUserId === numericId) return item.status;
    }
  }

  return 'none';
}

export async function requestCourseAccess(
  userId: string,
  courseId: string,
  userMeta?: { name?: string; customerCode?: string; telegramUserId?: number }
): Promise<CourseAccessItem> {
  await ensureAcademyAccessLoaded(true);

  const existingUser = DEMO_ACADEMY_USERS.find(u => u.id === userId);
  const key = `${userId}:${courseId}`;
  const record: CourseAccessItem = {
    userId,
    courseId,
    name: userMeta?.name || existingUser?.name || 'Mijoz',
    customerCode: userMeta?.customerCode || existingUser?.customerCode || 'YK-???',
    telegramUserId: userMeta?.telegramUserId || existingUser?.telegramUserId,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  courseAccessStore.set(key, record);

  if (!existingUser) {
    DEMO_ACADEMY_USERS.push({
      id: userId,
      name: record.name,
      customerCode: record.customerCode,
      telegramUserId: record.telegramUserId || 0,
    });
  }

  await saveCourseAccessToSupabase();

  return record;
}

export async function grantCourseAccess(
  identifier: string,
  courseId: string,
  userMeta?: { name?: string; customerCode?: string; telegramUserId?: number; id?: string }
): Promise<{ success: boolean; item?: CourseAccessItem; user?: any }> {
  await ensureAcademyAccessLoaded(true);

  const clean = identifier.trim().toUpperCase();
  const numericId = !isNaN(Number(clean)) ? Number(clean) : 0;

  // Find in demo users or matching ID
  let targetUser = DEMO_ACADEMY_USERS.find(
    u => u.id === identifier ||
         u.customerCode.toUpperCase() === clean ||
         String(u.telegramUserId) === clean ||
         u.name.toUpperCase().includes(clean)
  );

  // Also check existing requests in courseAccessStore
  let existingItem: CourseAccessItem | undefined;
  for (const item of courseAccessStore.values()) {
    if (
      item.customerCode.toUpperCase() === clean ||
      String(item.telegramUserId) === clean ||
      item.userId === identifier ||
      (item.name && item.name.toUpperCase().includes(clean))
    ) {
      existingItem = item;
      break;
    }
  }

  const userId = userMeta?.id || (targetUser ? targetUser.id : (existingItem ? existingItem.userId : identifier));
  const key = `${userId}:${courseId}`;
  const existing = existingItem || courseAccessStore.get(key);

  const updated: CourseAccessItem = {
    userId,
    courseId,
    name: userMeta?.name || targetUser?.name || existing?.name || `Foydalanuvchi (${identifier})`,
    customerCode: userMeta?.customerCode || targetUser?.customerCode || existing?.customerCode || (clean.startsWith('YK-') ? clean : identifier),
    telegramUserId: userMeta?.telegramUserId || targetUser?.telegramUserId || existing?.telegramUserId || (numericId > 100000 ? numericId : undefined),
    status: 'granted',
    grantedAt: new Date().toISOString(),
  };

  courseAccessStore.set(key, updated);

  if (!DEMO_ACADEMY_USERS.some(u => u.id === userId)) {
    DEMO_ACADEMY_USERS.push({
      id: userId,
      name: updated.name,
      customerCode: updated.customerCode,
      telegramUserId: updated.telegramUserId || 0,
    });
  }

  await saveCourseAccessToSupabase();

  return { success: true, item: updated, user: targetUser || { name: updated.name, telegramUserId: updated.telegramUserId } };
}

export async function revokeCourseAccess(
  identifier: string,
  courseId: string
): Promise<{ success: boolean; item?: CourseAccessItem }> {
  await ensureAcademyAccessLoaded(true);

  const clean = identifier.trim().toUpperCase();
  let targetUser = DEMO_ACADEMY_USERS.find(
    u => u.id === identifier ||
         u.customerCode.toUpperCase() === clean ||
         String(u.telegramUserId) === clean
  );

  let existingItem: CourseAccessItem | undefined;
  for (const item of courseAccessStore.values()) {
    if (
      item.customerCode.toUpperCase() === clean ||
      String(item.telegramUserId) === clean ||
      item.userId === identifier
    ) {
      existingItem = item;
      break;
    }
  }

  const userId = targetUser ? targetUser.id : (existingItem ? existingItem.userId : identifier);
  const key = `${userId}:${courseId}`;
  const existing = existingItem || courseAccessStore.get(key);

  if (existing) {
    existing.status = 'none';
    existing.grantedAt = undefined;
    await saveCourseAccessToSupabase();
    return { success: true, item: existing };
  }

  const updated: CourseAccessItem = {
    userId,
    courseId,
    name: targetUser?.name || identifier,
    customerCode: targetUser?.customerCode || identifier,
    status: 'none',
  };
  courseAccessStore.set(key, updated);
  await saveCourseAccessToSupabase();
  return { success: true, item: updated };
}

export async function getCourseAccessList(courseId: string): Promise<CourseAccessItem[]> {
  await ensureAcademyAccessLoaded();
  const supabase = getSupabase();

  const userList: Array<{ id: string; name: string; customerCode: string; telegramUserId?: number }> = [...DEMO_ACADEMY_USERS];

  if (supabase) {
    try {
      const { data: dbUsers } = await supabase
        .from('users')
        .select('id, name, customer_code, telegram_user_id')
        .order('created_at', { ascending: false });

      if (dbUsers && Array.isArray(dbUsers)) {
        for (const du of dbUsers) {
          if (!userList.some(u => u.id === du.id || u.customerCode === du.customer_code)) {
            userList.push({
              id: du.id,
              name: du.name || 'Mijoz',
              customerCode: du.customer_code || 'YK-???',
              telegramUserId: du.telegram_user_id,
            });
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  const result: CourseAccessItem[] = [];
  for (const u of userList) {
    const key = `${u.id}:${courseId}`;
    let rec = courseAccessStore.get(key);
    if (!rec) {
      for (const item of courseAccessStore.values()) {
        if (
          item.courseId === courseId &&
          (item.customerCode?.toUpperCase() === u.customerCode.toUpperCase() ||
           (u.telegramUserId && item.telegramUserId === u.telegramUserId))
        ) {
          rec = item;
          break;
        }
      }
    }

    result.push({
      userId: u.id,
      customerCode: u.customerCode,
      name: u.name,
      telegramUserId: u.telegramUserId,
      courseId,
      status: rec?.status || 'none',
      grantedAt: rec?.grantedAt,
      requestedAt: rec?.requestedAt,
    });
  }

  for (const item of courseAccessStore.values()) {
    if (item.courseId === courseId && !result.some(r => r.userId === item.userId || r.customerCode === item.customerCode)) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Fully wipe all progress, course access permissions, and student records for a user
 */
export function wipeAcademyUser(userIdOrCode: string): { wipedProgressCount: number; wipedAccessCount: number } {
  const clean = userIdOrCode.trim().toUpperCase();
  const matches = DEMO_ACADEMY_USERS.filter(
    u => u.id === userIdOrCode || u.customerCode.toUpperCase() === clean || String(u.telegramUserId) === clean
  );
  const userIdsToWipe = new Set<string>([userIdOrCode, ...matches.map(u => u.id)]);

  let wipedProgressCount = 0;
  for (const [key, prog] of progressStore.entries()) {
    if (userIdsToWipe.has(prog.userId)) {
      progressStore.delete(key);
      wipedProgressCount++;
    }
  }

  let wipedAccessCount = 0;
  for (const [key, access] of courseAccessStore.entries()) {
    if (userIdsToWipe.has(access.userId) || access.customerCode.toUpperCase() === clean) {
      courseAccessStore.delete(key);
      wipedAccessCount++;
    }
  }

  for (let i = DEMO_ACADEMY_USERS.length - 1; i >= 0; i--) {
    const u = DEMO_ACADEMY_USERS[i];
    if (u.id === userIdOrCode || u.customerCode.toUpperCase() === clean || String(u.telegramUserId) === clean) {
      DEMO_ACADEMY_USERS.splice(i, 1);
    }
  }

  return { wipedProgressCount, wipedAccessCount };
}
