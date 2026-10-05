/**
 * ==============================================================================
 * YUKLA GO ACADEMY - VIDEO LESSONS & PROGRESS ENGINE
 * ==============================================================================
 * Reusable Course Engine supporting sequential video lessons, anti-forward-seek
 * enforcement, server-side progress jump protection, and student tracking.
 */

import type { Course, Lesson, UserLessonProgress, StudentProgressSummary, CourseAccessItem, CourseAccessStatus } from '../../types';

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
  {
    id: 'course_english_logistics',
    title: 'Logistika & Biznes ingliz tili',
    description: 'Xalqaro yuk tashish, yetkazib beruvchilar bilan muzokara va buyurtmalar holatini aniqlash uchun amaliy ingliz tili darslari.',
    category: 'student',
    icon: '🇬🇧',
    order: 2,
  },
];

export let STORED_LESSONS: StoredLesson[] = [
  // ---------------------------------------------------------------------------
  // Course 1: Cargo Academy Lessons
  // ---------------------------------------------------------------------------
  {
    id: 'les_c1_1',
    courseId: 'course_cargo_101',
    order: 1,
    title: '1. Kirish: Xitoy karqo qanday ishlaydi?',
    description: 'Aviakargo va avtokargo farqlari, bojxona qoidalari va mijoz kodi (YK-###) mohiyati.',
    youtubeVideoId: 'M7lc1UVf-VE', // Sample YouTube ID (easily editable via Admin)
    durationSeconds: 360, // 6 minutes
  },
  {
    id: 'les_c1_2',
    courseId: 'course_cargo_101',
    order: 2,
    title: '2. Taobao va 1688 ilovalarida ro\'yxatdan o\'tish',
    description: 'Alipay hamyonini ulash, akkaunt xavfsizligi va blokdan saqlanish usullari.',
    youtubeVideoId: 'jNQXAC9IVRw',
    durationSeconds: 480, // 8 minutes
  },
  {
    id: 'les_c1_3',
    courseId: 'course_cargo_101',
    order: 3,
    title: '3. Xitoy ombor manzilini to\'g\'ri kiritish (YK-###)',
    description: 'Yukla Go ombor manzilini Taobao ilovasiga bir martalik nusxa orqali avtomatik joylash.',
    youtubeVideoId: '21X5lGlDOfg',
    durationSeconds: 420, // 7 minutes
  },
  {
    id: 'les_c1_4',
    courseId: 'course_cargo_101',
    order: 4,
    title: '4. To\'lov qilish va mahsulot sifatini tekshirish',
    description: 'Sotuvchi reytingi, mijozlar sharhlari va xavfsiz to\'lov tizimi.',
    youtubeVideoId: 'L_LUpnjgPso',
    durationSeconds: 540, // 9 minutes
  },
  {
    id: 'les_c1_5',
    courseId: 'course_cargo_101',
    order: 5,
    title: '5. Trek kodini kiritish va O\'zbekistonda qabul qilish',
    description: 'Yukni O\'zbekistonga yetib kelguncha kuzatish va belgilangan filialdan qabul qilib olish.',
    youtubeVideoId: 'fJ9rUzIMcZQ',
    durationSeconds: 390, // 6.5 minutes
  },

  // ---------------------------------------------------------------------------
  // Course 2: Student English Lessons
  // ---------------------------------------------------------------------------
  {
    id: 'les_c2_1',
    courseId: 'course_english_logistics',
    order: 1,
    title: 'Unit 1 — Essential Greetings & Communication with Suppliers',
    description: 'Supplier communication, polite requests, and price inquiries.',
    youtubeVideoId: 'dQw4w9WgXcQ',
    durationSeconds: 300,
  },
  {
    id: 'les_c2_2',
    courseId: 'course_english_logistics',
    order: 2,
    title: 'Unit 2 — Tracking, Weights & Measurements Vocabulary',
    description: 'Gross weight, dimensional weight, tracking numbers, and airway bills.',
    youtubeVideoId: 'jNQXAC9IVRw',
    durationSeconds: 420,
  },
  {
    id: 'les_c2_3',
    courseId: 'course_english_logistics',
    order: 3,
    title: 'Unit 3 — Resolving Delays & Damaged Packages',
    description: 'Dispute handling, refunds, and replacement order requests.',
    youtubeVideoId: '21X5lGlDOfg',
    durationSeconds: 480,
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

// Preload sample progress for demo
progressStore.set('usr_dev_100:les_c1_1', {
  userId: 'usr_dev_100',
  lessonId: 'les_c1_1',
  maxWatchedSeconds: 360,
  lastPositionSeconds: 360,
  completed: true,
  lastSyncTimestamp: Date.now() - 3600000,
  updatedAt: new Date(Date.now() - 3600000).toISOString(),
});

progressStore.set('usr_dev_100:les_c1_2', {
  userId: 'usr_dev_100',
  lessonId: 'les_c1_2',
  maxWatchedSeconds: 240,
  lastPositionSeconds: 240,
  completed: false,
  lastSyncTimestamp: Date.now() - 1800000,
  updatedAt: new Date(Date.now() - 1800000).toISOString(),
});

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
  return INITIAL_COURSES.map(course => {
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
export const DEMO_ACADEMY_USERS = [
  { id: 'usr_dev_100', name: 'Saidislom', customerCode: 'YK-100', telegramUserId: 99887766 },
  { id: 'usr_dev_101', name: 'Bobur Mirzo', customerCode: 'YK-101', telegramUserId: 99887767 },
  { id: 'usr_dev_102', name: 'Madina Alimova', customerCode: 'YK-102', telegramUserId: 99887768 },
  { id: 'usr_dev_103', name: 'Jasur Bek', customerCode: 'YK-103', telegramUserId: 99887769 },
];

const courseAccessStore = new Map<string, CourseAccessItem>();

// Seed default permissions
courseAccessStore.set('usr_dev_100:course_cargo_101', {
  userId: 'usr_dev_100',
  customerCode: 'YK-100',
  name: 'Saidislom',
  telegramUserId: 99887766,
  courseId: 'course_cargo_101',
  status: 'granted',
  grantedAt: new Date(Date.now() - 86400000).toISOString(),
});

courseAccessStore.set('usr_dev_101:course_cargo_101', {
  userId: 'usr_dev_101',
  customerCode: 'YK-101',
  name: 'Bobur Mirzo',
  telegramUserId: 99887767,
  courseId: 'course_cargo_101',
  status: 'pending',
  requestedAt: new Date(Date.now() - 3600000).toISOString(),
});

courseAccessStore.set('usr_dev_102:course_cargo_101', {
  userId: 'usr_dev_102',
  customerCode: 'YK-102',
  name: 'Madina Alimova',
  telegramUserId: 99887768,
  courseId: 'course_cargo_101',
  status: 'granted',
  grantedAt: new Date(Date.now() - 43200000).toISOString(),
});

export function hasUserCourseAccess(userId: string, courseId: string): boolean {
  const record = courseAccessStore.get(`${userId}:${courseId}`);
  return record?.status === 'granted';
}

export function getUserCourseAccessStatus(userId: string, courseId: string): CourseAccessStatus {
  const record = courseAccessStore.get(`${userId}:${courseId}`);
  return record?.status || 'none';
}

export function requestCourseAccess(
  userId: string,
  courseId: string,
  userMeta?: { name?: string; customerCode?: string; telegramUserId?: number }
): CourseAccessItem {
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

  return record;
}

export function grantCourseAccess(
  identifier: string,
  courseId: string
): { success: boolean; item?: CourseAccessItem; user?: any } {
  const clean = identifier.trim().toUpperCase();
  // Find in demo users or matching ID
  let targetUser = DEMO_ACADEMY_USERS.find(
    u => u.id === identifier ||
         u.customerCode.toUpperCase() === clean ||
         String(u.telegramUserId) === clean ||
         u.name.toUpperCase().includes(clean)
  );

  // Also check existing requests in courseAccessStore
  let existingItem: CourseAccessItem | undefined;
  if (!targetUser) {
    for (const item of courseAccessStore.values()) {
      if (
        item.customerCode.toUpperCase() === clean ||
        String(item.telegramUserId) === clean ||
        item.userId === identifier ||
        item.name.toUpperCase().includes(clean)
      ) {
        existingItem = item;
        break;
      }
    }
  }

  const userId = targetUser ? targetUser.id : (existingItem ? existingItem.userId : identifier);
  const key = `${userId}:${courseId}`;
  const existing = existingItem || courseAccessStore.get(key);

  const updated: CourseAccessItem = {
    userId,
    courseId,
    name: targetUser?.name || existing?.name || `Foydalanuvchi (${identifier})`,
    customerCode: targetUser?.customerCode || existing?.customerCode || identifier,
    telegramUserId: targetUser?.telegramUserId || existing?.telegramUserId,
    status: 'granted',
    grantedAt: new Date().toISOString(),
  };

  courseAccessStore.set(key, updated);

  // If user is not yet in DEMO_ACADEMY_USERS, add them
  if (!DEMO_ACADEMY_USERS.some(u => u.id === userId)) {
    DEMO_ACADEMY_USERS.push({
      id: userId,
      name: updated.name,
      customerCode: updated.customerCode,
      telegramUserId: updated.telegramUserId || 0,
    });
  }

  return { success: true, item: updated, user: targetUser };
}

export function revokeCourseAccess(
  identifier: string,
  courseId: string
): { success: boolean; item?: CourseAccessItem } {
  const clean = identifier.trim().toUpperCase();
  let targetUser = DEMO_ACADEMY_USERS.find(
    u => u.id === identifier || u.customerCode.toUpperCase() === clean || String(u.telegramUserId) === clean
  );

  let existingItem: CourseAccessItem | undefined;
  if (!targetUser) {
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
  }

  const userId = targetUser ? targetUser.id : (existingItem ? existingItem.userId : identifier);
  const key = `${userId}:${courseId}`;
  const existing = existingItem || courseAccessStore.get(key);

  if (existing) {
    existing.status = 'none';
    existing.grantedAt = undefined;
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
  return { success: true, item: updated };
}

export function getCourseAccessList(courseId: string): CourseAccessItem[] {
  return DEMO_ACADEMY_USERS.map(u => {
    const key = `${u.id}:${courseId}`;
    const rec = courseAccessStore.get(key);
    return {
      userId: u.id,
      customerCode: u.customerCode,
      name: u.name,
      telegramUserId: u.telegramUserId,
      courseId,
      status: rec?.status || 'none',
      grantedAt: rec?.grantedAt,
      requestedAt: rec?.requestedAt,
    };
  });
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
