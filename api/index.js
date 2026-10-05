// api/_lib/auth.ts
import crypto from "crypto";
import jwt from "jsonwebtoken";
var ADMIN_TELEGRAM_IDS = [7232597769, 5059829001];
function isTelegramAdmin(telegramUserId) {
  if (!telegramUserId) return false;
  const numId = Number(telegramUserId);
  return ADMIN_TELEGRAM_IDS.includes(numId);
}
function validateTelegramInitData(initData, maxAgeSeconds = 600, tokenOverride) {
  if (!initData) {
    return { valid: false, error: "initData is required" };
  }
  const botToken = tokenOverride || process.env.BOT_TOKEN || "";
  if (!botToken) {
    return { valid: false, error: "Server BOT_TOKEN not configured" };
  }
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) {
      return { valid: false, error: "Missing hash in initData" };
    }
    const authDateStr = params.get("auth_date");
    if (!authDateStr) {
      return { valid: false, error: "Missing auth_date" };
    }
    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1e3);
    if (isNaN(authDate) || now - authDate > maxAgeSeconds || authDate > now + 60) {
      return { valid: false, error: "Expired or invalid auth_date" };
    }
    params.delete("hash");
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map((key) => `${key}=${params.get(key)}`).join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    const hashBuffer = Buffer.from(hash, "hex");
    const calculatedBuffer = Buffer.from(calculatedHash, "hex");
    if (hashBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      return { valid: false, error: "Invalid HMAC signature" };
    }
    const userStr = params.get("user");
    let user;
    if (userStr) {
      user = JSON.parse(userStr);
    }
    return { valid: true, user };
  } catch (err) {
    return { valid: false, error: err?.message || "Verification exception" };
  }
}
function createSessionToken(payload, expiresIn = "25m") {
  const secret = process.env.JWT_SECRET || "yukla_go_dev_secret_replace_in_prod";
  return jwt.sign(payload, secret, { expiresIn });
}
function verifySessionToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const secret = process.env.JWT_SECRET || "yukla_go_dev_secret_replace_in_prod";
  try {
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (err) {
    return null;
  }
}

// api/_lib/academyData.ts
var INITIAL_COURSES = [
  {
    id: "course_cargo_101",
    title: "Xitoydan buyurtma berish kursi",
    description: "Xitoy saytlaridan (Taobao, 1688, Pinduoduo) mustaqil xarid qilish va O'zbekistonga tez yetkazib berish bo'yicha to'liq qo'llanma.",
    category: "cargo",
    icon: "\u{1F4E6}",
    order: 1
  }
];
var STORED_COURSES = [...INITIAL_COURSES];
function addCourse(data) {
  const newCourse = {
    id: `course_${Date.now()}`,
    title: data.title.trim(),
    description: data.description?.trim() || "",
    icon: data.icon?.trim() || "\u{1F4DA}",
    category: data.category || "general",
    order: STORED_COURSES.length + 1
  };
  STORED_COURSES.push(newCourse);
  return newCourse;
}
function deleteCourse(courseId) {
  const idx = STORED_COURSES.findIndex((c) => c.id === courseId);
  if (idx === -1) return false;
  STORED_COURSES.splice(idx, 1);
  STORED_LESSONS = STORED_LESSONS.filter((l) => l.courseId !== courseId);
  return true;
}
var STORED_LESSONS = [
  // ---------------------------------------------------------------------------
  // Primary Course: Cargo Academy Lessons
  // ---------------------------------------------------------------------------
  {
    id: "les_c1_1",
    courseId: "course_cargo_101",
    order: 1,
    title: "1. Kirish: Xitoy karqo qanday ishlaydi?",
    description: "Aviakargo va avtokargo farqlari, bojxona qoidalari va mijoz kodi (YK-###) mohiyati.",
    youtubeVideoId: "M7lc1UVf-VE",
    durationSeconds: 360
  },
  {
    id: "les_c1_2",
    courseId: "course_cargo_101",
    order: 2,
    title: "2. Taobao va 1688 ilovalarida ro'yxatdan o'tish",
    description: "Alipay hamyonini ulash, akkaunt xavfsizligi va blokdan saqlanish usullari.",
    youtubeVideoId: "jNQXAC9IVRw",
    durationSeconds: 480
  },
  {
    id: "les_c1_3",
    courseId: "course_cargo_101",
    order: 3,
    title: "3. Xitoy ombor manzilini to'g'ri kiritish (YK-###)",
    description: "Yukla Go ombor manzilini Taobao ilovasiga bir martalik nusxa orqali avtomatik joylash.",
    youtubeVideoId: "21X5lGlDOfg",
    durationSeconds: 420
  },
  {
    id: "les_c1_4",
    courseId: "course_cargo_101",
    order: 4,
    title: "4. To'lov qilish va mahsulot sifatini tekshirish",
    description: "Sotuvchi reytingi, mijozlar sharhlari va xavfsiz to'lov tizimi.",
    youtubeVideoId: "L_LUpnjgPso",
    durationSeconds: 540
  },
  {
    id: "les_c1_5",
    courseId: "course_cargo_101",
    order: 5,
    title: "5. Trek kodini kiritish va O'zbekistonda qabul qilish",
    description: "Yukni O'zbekistonga yetib kelguncha kuzatish va belgilangan filialdan qabul qilib olish.",
    youtubeVideoId: "fJ9rUzIMcZQ",
    durationSeconds: 390
  }
];
var progressStore = /* @__PURE__ */ new Map();
function extractYouTubeId(input) {
  if (!input) return "";
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (match && match[1]) return match[1];
  const fallback = trimmed.match(/(?:[?&]v=|\/)([a-zA-Z0-9_-]{11})(?:[?&/#]|$)/);
  if (fallback && fallback[1]) return fallback[1];
  return trimmed;
}
function getCoursesWithUserProgress(userId) {
  return STORED_COURSES.map((course) => {
    const courseLessons = STORED_LESSONS.filter((l) => l.courseId === course.id);
    const completedCount = courseLessons.filter((l) => {
      const rec = progressStore.get(`${userId}:${l.id}`);
      return rec?.completed === true;
    }).length;
    return {
      ...course,
      lessonsCount: courseLessons.length,
      completedLessonsCount: completedCount
    };
  });
}
function getCourseLessonsForUser(userId, courseId) {
  const courseLessons = STORED_LESSONS.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);
  let previousCompleted = true;
  return courseLessons.map((l) => {
    const rec = progressStore.get(`${userId}:${l.id}`);
    const isCompleted = rec?.completed === true;
    const isLocked = !previousCompleted;
    const maxWatched = rec?.maxWatchedSeconds || 0;
    const lastPos = rec?.lastPositionSeconds || 0;
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
      lastPositionSeconds: lastPos
    };
  });
}
function recordUserLessonProgress(userId, lessonId, reportedSeconds, clientReportedCompleted = false, bypassJumpProtection = false) {
  const lesson = STORED_LESSONS.find((l) => l.id === lessonId);
  if (!lesson) {
    throw new Error("Dars topilmadi");
  }
  const key = `${userId}:${lessonId}`;
  const now = Date.now();
  const existing = progressStore.get(key);
  let maxWatched = existing ? existing.maxWatchedSeconds : 0;
  const oldLastSync = existing ? existing.lastSyncTimestamp : now - 5e3;
  const elapsedRealSec = Math.max(1, (now - oldLastSync) / 1e3);
  const allowedMaxJump = Math.max(15, elapsedRealSec * 1.5 + 10);
  const targetWatched = Math.max(0, Math.min(reportedSeconds, lesson.durationSeconds));
  if (targetWatched > maxWatched) {
    if (!bypassJumpProtection && targetWatched - maxWatched > allowedMaxJump && !existing?.completed) {
      maxWatched = Math.min(lesson.durationSeconds, maxWatched + allowedMaxJump);
    } else {
      maxWatched = targetWatched;
    }
  }
  const isCompleted = existing?.completed || maxWatched >= lesson.durationSeconds * 0.95 || clientReportedCompleted && maxWatched >= lesson.durationSeconds * 0.85;
  const updatedRec = {
    userId,
    lessonId,
    maxWatchedSeconds: Math.floor(maxWatched),
    lastPositionSeconds: Math.floor(targetWatched),
    completed: isCompleted,
    lastSyncTimestamp: now,
    updatedAt: new Date(now).toISOString()
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
      updatedAt: updatedRec.updatedAt
    },
    unlockedNextLesson: isCompleted && !wasCompletedBefore
  };
}
function getStudentsProgressSummary(users, courseId = "course_cargo_101") {
  const courseLessons = STORED_LESSONS.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);
  const total = courseLessons.length;
  return users.map((user) => {
    let completedCount = 0;
    const lessonsDetail = courseLessons.map((l) => {
      const rec = progressStore.get(`${user.id}:${l.id}`);
      const isComp = rec?.completed === true;
      if (isComp) completedCount++;
      const maxW = rec?.maxWatchedSeconds || 0;
      const watchedPercent = Math.min(100, Math.round(maxW / (l.durationSeconds || 1) * 100));
      return {
        lessonId: l.id,
        title: l.title,
        order: l.order,
        completed: isComp,
        isCompleted: isComp,
        watchedPercent,
        percentage: watchedPercent,
        durationSeconds: l.durationSeconds,
        maxWatchedSeconds: maxW
      };
    });
    const pct = total > 0 ? Math.round(completedCount / total * 100) : 0;
    return {
      userId: user.id,
      name: user.name,
      customerCode: user.customerCode,
      completedCount,
      completedLessonsCount: completedCount,
      totalLessons: total,
      progressPercent: pct,
      completionPercentage: pct,
      lessons: lessonsDetail
    };
  });
}
function resetStudentProgress(userId, courseId) {
  const lessonsToReset = courseId ? STORED_LESSONS.filter((l) => l.courseId === courseId) : STORED_LESSONS;
  for (const l of lessonsToReset) {
    progressStore.delete(`${userId}:${l.id}`);
  }
  return true;
}
function addLessonToCourse(courseId, data) {
  const videoId = extractYouTubeId(data.youtubeUrlOrId);
  const courseLessons = STORED_LESSONS.filter((l) => l.courseId === courseId);
  const nextOrder = data.order || courseLessons.length + 1;
  const newLesson = {
    id: `les_${courseId.slice(7, 10)}_${Date.now()}`,
    courseId,
    order: nextOrder,
    title: data.title.trim(),
    description: data.description?.trim() || "",
    youtubeVideoId: videoId,
    durationSeconds: data.durationSeconds || 360
  };
  STORED_LESSONS.push(newLesson);
  return newLesson;
}
function deleteLesson(lessonId) {
  const idx = STORED_LESSONS.findIndex((l) => l.id === lessonId);
  if (idx !== -1) {
    STORED_LESSONS.splice(idx, 1);
    return true;
  }
  return false;
}
var DEMO_ACADEMY_USERS = [];
var courseAccessStore = /* @__PURE__ */ new Map();
var ADMIN_TELEGRAM_IDS2 = [7232597769, 5059829001];
function hasUserCourseAccess(userId, courseId) {
  const numericId = Number(userId);
  if (!isNaN(numericId) && ADMIN_TELEGRAM_IDS2.includes(numericId)) {
    return true;
  }
  const record = courseAccessStore.get(`${userId}:${courseId}`);
  return record?.status === "granted";
}
function getUserCourseAccessStatus(userId, courseId) {
  const record = courseAccessStore.get(`${userId}:${courseId}`);
  return record?.status || "none";
}
function requestCourseAccess(userId, courseId, userMeta) {
  const existingUser = DEMO_ACADEMY_USERS.find((u) => u.id === userId);
  const key = `${userId}:${courseId}`;
  const record = {
    userId,
    courseId,
    name: userMeta?.name || existingUser?.name || "Mijoz",
    customerCode: userMeta?.customerCode || existingUser?.customerCode || "YK-???",
    telegramUserId: userMeta?.telegramUserId || existingUser?.telegramUserId,
    status: "pending",
    requestedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  courseAccessStore.set(key, record);
  if (!existingUser) {
    DEMO_ACADEMY_USERS.push({
      id: userId,
      name: record.name,
      customerCode: record.customerCode,
      telegramUserId: record.telegramUserId || 0
    });
  }
  return record;
}
function grantCourseAccess(identifier, courseId) {
  const clean = identifier.trim().toUpperCase();
  let targetUser = DEMO_ACADEMY_USERS.find(
    (u) => u.id === identifier || u.customerCode.toUpperCase() === clean || String(u.telegramUserId) === clean || u.name.toUpperCase().includes(clean)
  );
  let existingItem;
  if (!targetUser) {
    for (const item of courseAccessStore.values()) {
      if (item.customerCode.toUpperCase() === clean || String(item.telegramUserId) === clean || item.userId === identifier || item.name.toUpperCase().includes(clean)) {
        existingItem = item;
        break;
      }
    }
  }
  const userId = targetUser ? targetUser.id : existingItem ? existingItem.userId : identifier;
  const key = `${userId}:${courseId}`;
  const existing = existingItem || courseAccessStore.get(key);
  const updated = {
    userId,
    courseId,
    name: targetUser?.name || existing?.name || `Foydalanuvchi (${identifier})`,
    customerCode: targetUser?.customerCode || existing?.customerCode || identifier,
    telegramUserId: targetUser?.telegramUserId || existing?.telegramUserId,
    status: "granted",
    grantedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  courseAccessStore.set(key, updated);
  if (!DEMO_ACADEMY_USERS.some((u) => u.id === userId)) {
    DEMO_ACADEMY_USERS.push({
      id: userId,
      name: updated.name,
      customerCode: updated.customerCode,
      telegramUserId: updated.telegramUserId || 0
    });
  }
  return { success: true, item: updated, user: targetUser };
}
function revokeCourseAccess(identifier, courseId) {
  const clean = identifier.trim().toUpperCase();
  let targetUser = DEMO_ACADEMY_USERS.find(
    (u) => u.id === identifier || u.customerCode.toUpperCase() === clean || String(u.telegramUserId) === clean
  );
  let existingItem;
  if (!targetUser) {
    for (const item of courseAccessStore.values()) {
      if (item.customerCode.toUpperCase() === clean || String(item.telegramUserId) === clean || item.userId === identifier) {
        existingItem = item;
        break;
      }
    }
  }
  const userId = targetUser ? targetUser.id : existingItem ? existingItem.userId : identifier;
  const key = `${userId}:${courseId}`;
  const existing = existingItem || courseAccessStore.get(key);
  if (existing) {
    existing.status = "none";
    existing.grantedAt = void 0;
    return { success: true, item: existing };
  }
  const updated = {
    userId,
    courseId,
    name: targetUser?.name || identifier,
    customerCode: targetUser?.customerCode || identifier,
    status: "none"
  };
  courseAccessStore.set(key, updated);
  return { success: true, item: updated };
}
function getCourseAccessList(courseId) {
  return DEMO_ACADEMY_USERS.map((u) => {
    const key = `${u.id}:${courseId}`;
    const rec = courseAccessStore.get(key);
    return {
      userId: u.id,
      customerCode: u.customerCode,
      name: u.name,
      telegramUserId: u.telegramUserId,
      courseId,
      status: rec?.status || "none",
      grantedAt: rec?.grantedAt,
      requestedAt: rec?.requestedAt
    };
  });
}
function wipeAcademyUser(userIdOrCode) {
  const clean = userIdOrCode.trim().toUpperCase();
  const matches = DEMO_ACADEMY_USERS.filter(
    (u) => u.id === userIdOrCode || u.customerCode.toUpperCase() === clean || String(u.telegramUserId) === clean
  );
  const userIdsToWipe = /* @__PURE__ */ new Set([userIdOrCode, ...matches.map((u) => u.id)]);
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

// api/_handlers/academyCourses.ts
async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = verifySessionToken(req.headers.authorization);
  const userId = session?.userId || (session?.telegramUserId ? String(session.telegramUserId) : "guest_user");
  const isAdmin = session?.role === "admin" || session?.role === "super_admin" || session?.telegramUserId && [7232597769, 5059829001].includes(session.telegramUserId);
  const { courseId } = req.query;
  if (courseId) {
    const cId = String(courseId);
    const hasAccess = isAdmin || hasUserCourseAccess(userId, cId);
    const accessStatus = isAdmin ? "granted" : getUserCourseAccessStatus(userId, cId);
    if (!hasAccess) {
      return res.status(200).json({
        hasAccess: false,
        accessStatus,
        lessons: [],
        message: "Ushbu darslarni ko'rish uchun administrator ruxsati talab qilinadi."
      });
    }
    const lessons = getCourseLessonsForUser(userId, cId);
    return res.status(200).json({
      hasAccess: true,
      accessStatus: "granted",
      lessons
    });
  }
  const courses = getCoursesWithUserProgress(userId);
  return res.status(200).json(courses);
}

// api/_handlers/academyProgress.ts
async function handler2(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = verifySessionToken(req.headers.authorization);
  const userId = session?.userId || (session?.telegramUserId ? String(session.telegramUserId) : "guest_user");
  const { lessonId, watchedSeconds, completed = false } = req.body || {};
  if (!lessonId || typeof watchedSeconds !== "number") {
    return res.status(400).json({ error: "lessonId va watchedSeconds talab qilinadi" });
  }
  try {
    const result = recordUserLessonProgress(
      userId,
      String(lessonId),
      Number(watchedSeconds),
      Boolean(completed)
    );
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Xatolik yuz berdi" });
  }
}

// api/_lib/botNotifications.ts
import fs from "fs";
import path from "path";
var MINI_APP_URL = process.env.MINI_APP_URL || "https://yuklago.vercel.app";
function getBotToken() {
  if (process.env.BOT_TOKEN) return process.env.BOT_TOKEN;
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^BOT_TOKEN=(.+)$/m);
      if (match && match[1]) {
        const val = match[1].trim();
        process.env.BOT_TOKEN = val;
        return val;
      }
    }
  } catch {
  }
  return "";
}
var STATUS_MESSAGES = {
  added: {
    title: "\u{1F4DD} Yangi trek kiritildi",
    desc: "Trek kodi tizimga kiritildi va Xitoy omborida kutilmoqda."
  },
  china_warehouse: {
    title: "\u{1F1E8}\u{1F1F3} Xitoy omboriga qabul qilindi",
    desc: "Yukingiz Xitoy omboriga muvaffaqiyatli yetib keldi va jo'natishga tayyorlanmoqda."
  },
  in_transit: {
    title: "\u2708\uFE0F Yukingiz yo'lga chiqdi",
    desc: "Yukingiz samolyotda O'zbekistonga parvoz qilmoqda."
  },
  uzbekistan: {
    title: "\u{1F1FA}\u{1F1FF} Yukingiz O'zbekistonga yetib keldi",
    desc: "Yukingiz Toshkentdagi saralash markaziga yetib keldi va belgilangan filialga yuborilmoqda."
  },
  delivered: {
    title: "\u{1F389} Yukingiz yetkazildi",
    desc: "Yukingiz belgilangan filialda qabul qilindi va yetkazib berildi."
  }
};
async function sendTelegramMessage(chatId, text, replyMarkup) {
  const token = getBotToken();
  if (!token) {
    console.log(`[BOT DEV NOTIFY] No BOT_TOKEN. Message to ${chatId}: ${text}`);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`Telegram API error for chat ${chatId}:`, json);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send Telegram notification:", err);
    return false;
  }
}
async function notifyParcelStatusUpdate(telegramUserId, trackingNumber, newStatus, weightKg, amount) {
  const statusInfo = STATUS_MESSAGES[newStatus] || {
    title: "\u{1F4E6} Yuk holati yangilandi",
    desc: `Yangi holat: ${newStatus}`
  };
  let details = "";
  if (weightKg && weightKg > 0) {
    details += `
\u2696\uFE0F Vazni: <b>${weightKg} kg</b>`;
  }
  if (amount && amount > 0) {
    details += `
\u{1F4B5} To'lov summasi: <b>$${amount.toFixed(2)}</b>`;
  }
  const message = `<b>${statusInfo.title}</b>

\u{1F4E6} Trek raqami: <code>${trackingNumber}</code>
\u2139\uFE0F ${statusInfo.desc}${details}

Batafsil ma'lumotni ilovada ko'rishingiz mumkin:`;
  const keyboard = {
    inline_keyboard: [
      [{ text: "\u{1F4E6} Yukla Go ilovasini ochish", web_app: { url: MINI_APP_URL } }]
    ]
  };
  return sendTelegramMessage(telegramUserId, message, keyboard);
}

// api/_handlers/academyRequestAccess.ts
async function handler3(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = verifySessionToken(req.headers.authorization);
  const { courseId, name, customerCode, telegramUserId } = req.body || {};
  const userId = session?.userId || (session?.telegramUserId ? String(session.telegramUserId) : telegramUserId ? String(telegramUserId) : "guest_user");
  if (!courseId) {
    return res.status(400).json({ error: "courseId talab qilinadi" });
  }
  const item = requestCourseAccess(userId, String(courseId), {
    name,
    customerCode,
    telegramUserId: telegramUserId ? Number(telegramUserId) : void 0
  });
  const course = INITIAL_COURSES.find((c) => c.id === courseId);
  const courseTitle = course?.title || courseId;
  try {
    const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
    if (adminChatId) {
      await sendTelegramMessage(
        adminChatId,
        `\u{1F514} <b>Yangi darslik so'rovi!</b>

\u{1F464} Talaba: <b>${item.name}</b> (<code>${item.customerCode}</code>)
\u{1F4DA} Kurs: <b>${courseTitle}</b>

<i>Admin panel orqali ruxsat berishingiz mumkin.</i>`
      );
    }
  } catch {
  }
  return res.status(200).json({
    success: true,
    message: "So'rovingiz qabul qilindi. Administrator tez orada tasdiqlaydi.",
    item
  });
}

// api/_lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var clientInstance = null;
var getSupabase = () => {
  if (clientInstance) return clientInstance;
  if (supabaseUrl && supabaseServiceKey) {
    clientInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    return clientInstance;
  }
  return null;
};

// api/_lib/branchesData.ts
var REGIONS_LIST = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Andijon viloyati",
  "Farg'ona viloyati",
  "Namangan viloyati",
  "Samarqand viloyati",
  "Buxoro viloyati",
  "Navoiy viloyati",
  "Qashqadaryo viloyati",
  "Surxondaryo viloyati",
  "Jizzax viloyati",
  "Sirdaryo viloyati",
  "Xorazm viloyati",
  "Qoraqalpog'iston Res."
];
var ALL_BRANCHES = [
  // ---------------------------------------------------------------------------
  // 1. Toshkent shahri
  // ---------------------------------------------------------------------------
  { id: "bts_tosh_chilonzor", provider: "BTS", branchName: "BTS Chilonzor", region: "Toshkent shahri", address: "Chilonzor 9-mavze, Qatortol 1" },
  { id: "bts_tosh_yunusobod", provider: "BTS", branchName: "BTS Yunusobod", region: "Toshkent shahri", address: "Yunusobod 11-mavze, Ahmad Donish 44" },
  { id: "bts_tosh_chorsu", provider: "BTS", branchName: "BTS Chorsu", region: "Toshkent shahri", address: "Navoiy shoh ko'chasi 32" },
  { id: "bts_tosh_mirobod", provider: "BTS", branchName: "BTS Mirobod", region: "Toshkent shahri", address: "Nukus ko'chasi 29" },
  { id: "bts_tosh_sergeli", provider: "BTS", branchName: "BTS Sergeli", region: "Toshkent shahri", address: "Yangisirgli ko'chasi 14" },
  { id: "emu_tosh_yunusobod", provider: "EMU", branchName: "EMU Yunusobod", region: "Toshkent shahri", address: "Yunusobod 4-mavze, 15-uy" },
  { id: "emu_tosh_chilonzor", provider: "EMU", branchName: "EMU Chilonzor", region: "Toshkent shahri", address: "Muqimiy ko'chasi 76" },
  { id: "emu_tosh_mirobod", provider: "EMU", branchName: "EMU Mirobod (Oybek)", region: "Toshkent shahri", address: "Oybek ko'chasi 18" },
  { id: "emu_tosh_olmazor", provider: "EMU", branchName: "EMU Olmazor", region: "Toshkent shahri", address: "Qorasaroy ko'chasi 12" },
  { id: "emu_tosh_sergeli", provider: "EMU", branchName: "EMU Sergeli", region: "Toshkent shahri", address: "Cho'ponota ko'chasi 5" },
  { id: "uzp_tosh_glavpocht", provider: "UZPOST", branchName: "Bosh Pochtampt 100000", region: "Toshkent shahri", address: "Shahrisabz ko'chasi 7" },
  { id: "uzp_tosh_chilonzor", provider: "UZPOST", branchName: "UzPost Chilonzor", region: "Toshkent shahri", address: "Chilonzor 2-mavze, 10-uy" },
  { id: "uzp_tosh_yunusobod", provider: "UZPOST", branchName: "UzPost Yunusobod", region: "Toshkent shahri", address: "Yunusobod 7-mavze" },
  // ---------------------------------------------------------------------------
  // 2. Toshkent viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_toshvil_chirchiq", provider: "BTS", branchName: "BTS Chirchiq", region: "Toshkent viloyati", address: "A. Navoiy ko'chasi 25" },
  { id: "bts_toshvil_olmaliq", provider: "BTS", branchName: "BTS Olmaliq", region: "Toshkent viloyati", address: "Metallurglar ko'chasi 10" },
  { id: "bts_toshvil_angren", provider: "BTS", branchName: "BTS Angren", region: "Toshkent viloyati", address: "Mustaqillik ko'chasi 8" },
  { id: "bts_toshvil_bekobod", provider: "BTS", branchName: "BTS Bekobod", region: "Toshkent viloyati", address: "S. Ayniy ko'chasi 14" },
  { id: "emu_toshvil_chirchiq", provider: "EMU", branchName: "EMU Chirchiq", region: "Toshkent viloyati", address: "Lomonosov ko'chasi 3" },
  { id: "emu_toshvil_olmaliq", provider: "EMU", branchName: "EMU Olmaliq", region: "Toshkent viloyati", address: "Amir Temur ko'chasi 19" },
  { id: "emu_toshvil_bekobod", provider: "EMU", branchName: "EMU Bekobod", region: "Toshkent viloyati", address: "Yoshlik ko'chasi 2" },
  { id: "uzp_toshvil_chirchiq", provider: "UZPOST", branchName: "UzPost Chirchiq Markaz", region: "Toshkent viloyati", address: "Navoiy shoh 12" },
  { id: "uzp_toshvil_olmaliq", provider: "UZPOST", branchName: "UzPost Olmaliq Markaz", region: "Toshkent viloyati", address: "Metallurglar 5" },
  // ---------------------------------------------------------------------------
  // 3. Andijon viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_and_markaz", provider: "BTS", branchName: "BTS Andijon Markaz", region: "Andijon viloyati", address: "Bobur shoh ko'chasi 45" },
  { id: "bts_and_asaka", provider: "BTS", branchName: "BTS Asaka", region: "Andijon viloyati", address: "O'zbekiston ko'chasi 12" },
  { id: "bts_and_shahrixon", provider: "BTS", branchName: "BTS Shahrixon", region: "Andijon viloyati", address: "Mustaqillik ko'chasi 22" },
  { id: "emu_and_markaz", provider: "EMU", branchName: "EMU Andijon Markaz", region: "Andijon viloyati", address: "Mashrab ko'chasi 18" },
  { id: "emu_and_asaka", provider: "EMU", branchName: "EMU Asaka", region: "Andijon viloyati", address: "Navoiy ko'chasi 9" },
  { id: "emu_and_qorgontepa", provider: "EMU", branchName: "EMU Qo'rg'ontepa", region: "Andijon viloyati", address: "Istiqlol ko'chasi 4" },
  { id: "uzp_and_markaz", provider: "UZPOST", branchName: "UzPost Andijon Bosh Pochtampt", region: "Andijon viloyati", address: "Navoiy shoh 31" },
  { id: "uzp_and_asaka", provider: "UZPOST", branchName: "UzPost Asaka", region: "Andijon viloyati", address: "Bobur shoh 14" },
  // ---------------------------------------------------------------------------
  // 4. Farg'ona viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_far_markaz", provider: "BTS", branchName: "BTS Farg'ona Markaz", region: "Farg'ona viloyati", address: "Al-Farg'oniy ko'chasi 78" },
  { id: "bts_far_qoqon", provider: "BTS", branchName: "BTS Qo'qon", region: "Farg'ona viloyati", address: "Turkiston ko'chasi 54" },
  { id: "bts_far_margilon", provider: "BTS", branchName: "BTS Marg'ilon", region: "Farg'ona viloyati", address: "B. Marg'iloniy ko'chasi 11" },
  { id: "emu_far_markaz", provider: "EMU", branchName: "EMU Farg'ona Markaz", region: "Farg'ona viloyati", address: "Marfua ko'chasi 21" },
  { id: "emu_far_qoqon", provider: "EMU", branchName: "EMU Qo'qon", region: "Farg'ona viloyati", address: "Charxiy ko'chasi 15" },
  { id: "emu_far_margilon", provider: "EMU", branchName: "EMU Marg'ilon", region: "Farg'ona viloyati", address: "Xiyobon ko'chasi 6" },
  { id: "uzp_far_markaz", provider: "UZPOST", branchName: "UzPost Farg'ona Bosh Pochtampt", region: "Farg'ona viloyati", address: "Al-Farg'oniy 5" },
  { id: "uzp_far_qoqon", provider: "UZPOST", branchName: "UzPost Qo'qon", region: "Farg'ona viloyati", address: "Turkiston 10" },
  // ---------------------------------------------------------------------------
  // 5. Namangan viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_nam_chorsu", provider: "BTS", branchName: "BTS Chorsu Markaz", region: "Namangan viloyati", address: "Namangan sh., Chorsu dahasi, 12-uy" },
  { id: "bts_nam_kosonsoy", provider: "BTS", branchName: "BTS Kosonsoy", region: "Namangan viloyati", address: "Toshkent ko'chasi 15" },
  { id: "bts_nam_chust", provider: "BTS", branchName: "BTS Chust", region: "Namangan viloyati", address: "Tinchlik ko'chasi 8" },
  { id: "bts_nam_uchqorgon", provider: "BTS", branchName: "BTS Uchqo'rg'on", region: "Namangan viloyati", address: "Do'stlik ko'chasi 4" },
  { id: "emu_nam_markaz", provider: "EMU", branchName: "EMU Namangan Markaz", region: "Namangan viloyati", address: "To'raqo'rg'on ko'chasi 42" },
  { id: "emu_nam_chortoq", provider: "EMU", branchName: "EMU Chortoq", region: "Namangan viloyati", address: "Mustaqillik ko'chasi 10" },
  { id: "emu_nam_pop", provider: "EMU", branchName: "EMU Pop", region: "Namangan viloyati", address: "Navoiy ko'chasi 22" },
  { id: "uzp_nam_markaz", provider: "UZPOST", branchName: "UzPost Namangan Bosh Pochtampt", region: "Namangan viloyati", address: "Navoiy ko'chasi 36" },
  { id: "uzp_nam_chust", provider: "UZPOST", branchName: "UzPost Chust Markaz", region: "Namangan viloyati", address: "Tinchlik ko'chasi 1" },
  // ---------------------------------------------------------------------------
  // 6. Samarqand viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_sam_markaz", provider: "BTS", branchName: "BTS Samarqand Markaz", region: "Samarqand viloyati", address: "Mirzo Ulug'bek ko'chasi 45" },
  { id: "bts_sam_registon", provider: "BTS", branchName: "BTS Registon", region: "Samarqand viloyati", address: "Dahbed ko'chasi 12" },
  { id: "bts_sam_kattaqorgon", provider: "BTS", branchName: "BTS Kattaqo'rg'on", region: "Samarqand viloyati", address: "Amir Temur ko'chasi 18" },
  { id: "bts_sam_urgut", provider: "BTS", branchName: "BTS Urgut", region: "Samarqand viloyati", address: "Navoiy shoh ko'chasi 9" },
  { id: "emu_sam_markaz", provider: "EMU", branchName: "EMU Samarqand Markaz", region: "Samarqand viloyati", address: "Beruniy ko'chasi 28" },
  { id: "emu_sam_panjakent", provider: "EMU", branchName: "EMU Panjakent", region: "Samarqand viloyati", address: "Panjakent ko'chasi 60" },
  { id: "emu_sam_urgut", provider: "EMU", branchName: "EMU Urgut", region: "Samarqand viloyati", address: "Urgut Markaz, Dehqon bozori" },
  { id: "uzp_sam_markaz", provider: "UZPOST", branchName: "UzPost Samarqand Bosh Pochtampt", region: "Samarqand viloyati", address: "Pochta ko'chasi 1" },
  { id: "uzp_sam_kattaqorgon", provider: "UZPOST", branchName: "UzPost Kattaqo'rg'on", region: "Samarqand viloyati", address: "Amir Temur ko'chasi 3" },
  // ---------------------------------------------------------------------------
  // 7. Buxoro viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_bux_markaz", provider: "BTS", branchName: "BTS Buxoro Markaz", region: "Buxoro viloyati", address: "Ibn Sino ko'chasi 56" },
  { id: "bts_bux_gijduvon", provider: "BTS", branchName: "BTS G'ijduvon", region: "Buxoro viloyati", address: "Yusuf Hamadoniy ko'chasi 14" },
  { id: "emu_bux_markaz", provider: "EMU", branchName: "EMU Buxoro Markaz", region: "Buxoro viloyati", address: "Navoiy shoh ko'chasi 33" },
  { id: "emu_bux_kogon", provider: "EMU", branchName: "EMU Kogon", region: "Buxoro viloyati", address: "Buxoro ko'chasi 8" },
  { id: "uzp_bux_markaz", provider: "UZPOST", branchName: "UzPost Buxoro Bosh Pochtampt", region: "Buxoro viloyati", address: "Mustaqillik ko'chasi 12" },
  { id: "uzp_bux_gijduvon", provider: "UZPOST", branchName: "UzPost G'ijduvon", region: "Buxoro viloyati", address: "Hamadoniy ko'chasi 4" },
  // ---------------------------------------------------------------------------
  // 8. Navoiy viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_nav_markaz", provider: "BTS", branchName: "BTS Navoiy Markaz", region: "Navoiy viloyati", address: "Zarafshon shoh ko'chasi 12" },
  { id: "bts_nav_zarafshon", provider: "BTS", branchName: "BTS Zarafshon", region: "Navoiy viloyati", address: "Murodov ko'chasi 5" },
  { id: "emu_nav_markaz", provider: "EMU", branchName: "EMU Navoiy Markaz", region: "Navoiy viloyati", address: "G'alaba shoh ko'chasi 19" },
  { id: "emu_nav_zarafshon", provider: "EMU", branchName: "EMU Zarafshon", region: "Navoiy viloyati", address: "Quruvchilar ko'chasi 10" },
  { id: "uzp_nav_markaz", provider: "UZPOST", branchName: "UzPost Navoiy Bosh Pochtampt", region: "Navoiy viloyati", address: "Xalqlar Do'stligi 8" },
  // ---------------------------------------------------------------------------
  // 9. Qashqadaryo viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_qash_qarshi", provider: "BTS", branchName: "BTS Qarshi Markaz", region: "Qashqadaryo viloyati", address: "Mustaqillik shoh ko'chasi 21" },
  { id: "bts_qash_shahrisabz", provider: "BTS", branchName: "BTS Shahrisabz", region: "Qashqadaryo viloyati", address: "Ipak Yo'li ko'chasi 44" },
  { id: "bts_qash_koson", provider: "BTS", branchName: "BTS Koson", region: "Qashqadaryo viloyati", address: "Navoiy ko'chasi 17" },
  { id: "emu_qash_qarshi", provider: "EMU", branchName: "EMU Qarshi Markaz", region: "Qashqadaryo viloyati", address: "Nasaf ko'chasi 38" },
  { id: "emu_qash_shahrisabz", provider: "EMU", branchName: "EMU Shahrisabz", region: "Qashqadaryo viloyati", address: "Ipak Yo'li ko'chasi 12" },
  { id: "uzp_qash_qarshi", provider: "UZPOST", branchName: "UzPost Qarshi Bosh Pochtampt", region: "Qashqadaryo viloyati", address: "O'zbekiston ko'chasi 2" },
  // ---------------------------------------------------------------------------
  // 10. Surxondaryo viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_surx_termiz", provider: "BTS", branchName: "BTS Termiz Markaz", region: "Surxondaryo viloyati", address: "At-Termiziy ko'chasi 67" },
  { id: "bts_surx_denov", provider: "BTS", branchName: "BTS Denov", region: "Surxondaryo viloyati", address: "Mustaqillik ko'chasi 33" },
  { id: "emu_surx_termiz", provider: "EMU", branchName: "EMU Termiz Markaz", region: "Surxondaryo viloyati", address: "Navoiy ko'chasi 14" },
  { id: "emu_surx_denov", provider: "EMU", branchName: "EMU Denov", region: "Surxondaryo viloyati", address: "Sh. Rashidov ko'chasi 20" },
  { id: "uzp_surx_termiz", provider: "UZPOST", branchName: "UzPost Termiz Bosh Pochtampt", region: "Surxondaryo viloyati", address: "At-Termiziy 19" },
  // ---------------------------------------------------------------------------
  // 11. Jizzax viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_jiz_markaz", provider: "BTS", branchName: "BTS Jizzax Markaz", region: "Jizzax viloyati", address: "Sh. Rashidov shoh ko'chasi 52" },
  { id: "emu_jiz_markaz", provider: "EMU", branchName: "EMU Jizzax Markaz", region: "Jizzax viloyati", address: "Sayiljoyi ko'chasi 15" },
  { id: "uzp_jiz_markaz", provider: "UZPOST", branchName: "UzPost Jizzax Bosh Pochtampt", region: "Jizzax viloyati", address: "Sh. Rashidov ko'chasi 14" },
  // ---------------------------------------------------------------------------
  // 12. Sirdaryo viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_sir_guliston", provider: "BTS", branchName: "BTS Guliston Markaz", region: "Sirdaryo viloyati", address: "O'zbekiston ko'chasi 81" },
  { id: "bts_sir_yangiyer", provider: "BTS", branchName: "BTS Yangiyer", region: "Sirdaryo viloyati", address: "Tinchlik ko'chasi 9" },
  { id: "emu_sir_guliston", provider: "EMU", branchName: "EMU Guliston Markaz", region: "Sirdaryo viloyati", address: "Sayxun ko'chasi 11" },
  { id: "uzp_sir_guliston", provider: "UZPOST", branchName: "UzPost Guliston Bosh Pochtampt", region: "Sirdaryo viloyati", address: "Mustaqillik ko'chasi 25" },
  // ---------------------------------------------------------------------------
  // 13. Xorazm viloyati
  // ---------------------------------------------------------------------------
  { id: "bts_xor_urganch", provider: "BTS", branchName: "BTS Urganch Markaz", region: "Xorazm viloyati", address: "Al-Xorazmiy ko'chasi 90" },
  { id: "bts_xor_xiva", provider: "BTS", branchName: "BTS Xiva", region: "Xorazm viloyati", address: "Feruz ko'chasi 12" },
  { id: "emu_xor_urganch", provider: "EMU", branchName: "EMU Urganch Markaz", region: "Xorazm viloyati", address: "Pahlavon Mahmud ko'chasi 24" },
  { id: "emu_xor_bogot", provider: "EMU", branchName: "EMU Bog'ot", region: "Xorazm viloyati", address: "Markaziy ko'cha 7" },
  { id: "uzp_xor_urganch", provider: "UZPOST", branchName: "UzPost Urganch Bosh Pochtampt", region: "Xorazm viloyati", address: "Al-Xorazmiy 15" },
  // ---------------------------------------------------------------------------
  // 14. Qoraqalpog'iston Respublikasi
  // ---------------------------------------------------------------------------
  { id: "bts_qor_nukus", provider: "BTS", branchName: "BTS Nukus Markaz", region: "Qoraqalpog'iston Res.", address: "Qoraqalpog'iston ko'chasi 35" },
  { id: "bts_qor_qongirot", provider: "BTS", branchName: "BTS Qo'ng'irot", region: "Qoraqalpog'iston Res.", address: "G'arezsizlik ko'chasi 18" },
  { id: "emu_qor_nukus", provider: "EMU", branchName: "EMU Nukus Markaz", region: "Qoraqalpog'iston Res.", address: "Tatibayev ko'chasi 16" },
  { id: "emu_qor_beruniy", provider: "EMU", branchName: "EMU Beruniy", region: "Qoraqalpog'iston Res.", address: "Beruniy Markaziy ko'cha 5" },
  { id: "uzp_qor_nukus", provider: "UZPOST", branchName: "UzPost Nukus Bosh Pochtampt", region: "Qoraqalpog'iston Res.", address: "Dosnazarov ko'chasi 22" }
];
function getBranches(provider, region) {
  let list = ALL_BRANCHES;
  if (provider) {
    const provUpper = provider.toUpperCase();
    list = list.filter((b) => b.provider === provUpper);
  }
  if (region) {
    const regLower = region.toLowerCase().trim();
    list = list.filter((b) => b.region.toLowerCase().includes(regLower) || regLower.includes(b.region.toLowerCase()));
  }
  return list;
}
function getRegionsForProvider(provider) {
  const provUpper = provider.toUpperCase();
  const branches = ALL_BRANCHES.filter((b) => b.provider === provUpper);
  return Array.from(new Set(branches.map((b) => b.region)));
}
function findBranchById(id) {
  return ALL_BRANCHES.find((b) => b.id === id);
}

// api/_lib/ofertaData.ts
var DEFAULT_OFERTA_TITLE = "Yukla Go Xizmatidan Foydalanish Shartlari (Ommaviy Oferta)";
var DEFAULT_OFERTA_CONTENT = `1. Umumiy qoidalar:
Ushbu ommaviy oferta "Yukla Go" xizmati orqali Xitoydan O'zbekistonga posilka va tovarlarni yetkazib berish xizmatidan foydalanish qoidalarini belgilaydi.

2. Ro'yxatdan o'tish va mijoz kodi:
Har bir foydalanuvchiga shaxsiy identifikatsiya kodi (masalan: YK-100) biriktiriladi. Foydalanuvchi barcha xaridlarida ombor manziliga ushbu kodni to'liq kiritishi shart.

3. Taqiqlangan tovarlar:
Aviakargo orqali suyuqliklar, litiy batareyalar, qurol-yarog', tez yonuvchan moddalar, qalbaki tovarlar va O'zbekiston qonunchiligida taqiqlangan boshqa mahsulotlarni yuborish qat'iyan man etiladi.

4. Yetkazib berish va to'lov:
Yuklar O'zbekistonga yetib kelgach, amaldagi tarif bo'yicha hisob-kitob qilinadi. To'lov yuk topshirilguniga qadar to'liq amalga oshirilishi shart.

5. O'quv materiallari va darslar:
Yukla Go Akademiya video darslari xizmatdan to'g'ri foydalanishni o'rgatish maqsadida taqdim etiladi. Darslarni nusxalash, tarqatish yoki uchinchi shaxslarga berish taqiqlanadi.`;
var inMemoryOferta = {
  title: DEFAULT_OFERTA_TITLE,
  content: DEFAULT_OFERTA_CONTENT,
  updatedAt: (/* @__PURE__ */ new Date()).toISOString()
};
async function getOfertaText() {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await supabase.from("oferta_versions").select("title, content").eq("is_active", true).order("version", { ascending: false }).limit(1).single();
      if (data && data.content) {
        inMemoryOferta = {
          title: data.title || DEFAULT_OFERTA_TITLE,
          content: data.content,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        return { title: inMemoryOferta.title, content: inMemoryOferta.content };
      }
    } catch {
    }
  }
  return { title: inMemoryOferta.title, content: inMemoryOferta.content };
}
async function updateOfertaText(content, title) {
  const cleanContent = content.trim();
  const cleanTitle = title?.trim() || inMemoryOferta.title || DEFAULT_OFERTA_TITLE;
  inMemoryOferta = {
    title: cleanTitle,
    content: cleanContent,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from("oferta_versions").upsert({
        version: Date.now(),
        title: cleanTitle,
        content: cleanContent,
        is_active: true
      });
    } catch {
    }
  }
  return true;
}

// api/_lib/botEngine.ts
var MINI_APP_URL2 = process.env.MINI_APP_URL || "https://yuklago.vercel.app";
var inMemoryUsers = /* @__PURE__ */ new Map();
var nextCustomerCodeNum = 100;
function wipeBotUser(identifier) {
  const numericId = typeof identifier === "number" ? identifier : Number(identifier);
  let wipedUser;
  if (!isNaN(numericId) && inMemoryUsers.has(numericId)) {
    wipedUser = inMemoryUsers.get(numericId);
    inMemoryUsers.delete(numericId);
    return { success: true, wipedUser };
  }
  const clean = String(identifier).trim().toUpperCase();
  for (const [tgId, user] of inMemoryUsers.entries()) {
    if (user.id === identifier || user.customerCode.toUpperCase() === clean || String(user.telegramUserId) === clean || user.name && user.name.toUpperCase().includes(clean)) {
      wipedUser = user;
      inMemoryUsers.delete(tgId);
      return { success: true, wipedUser };
    }
  }
  return { success: false };
}
function getInMemoryBotUsers() {
  return Array.from(inMemoryUsers.values());
}
var ADMIN_TELEGRAM_IDS3 = [7232597769, 5059829001];
var getAdminKeyboard = () => {
  return {
    keyboard: [
      [{ text: "\u{1F393} Video darslar (Foydalanuvchi)", web_app: { url: MINI_APP_URL2 } }],
      [{ text: "\u2699\uFE0F Admin Dashboard", web_app: { url: `${MINI_APP_URL2}#admin` } }],
      [
        { text: "\u{1F464} Mening profilim" },
        { text: "\u260E\uFE0F Yordam" }
      ]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
};
var getMainKeyboard = () => {
  return {
    keyboard: [
      [{ text: "\u{1F393} Video darslar", web_app: { url: MINI_APP_URL2 } }],
      [
        { text: "\u{1F464} Mening profilim" },
        { text: "\u260E\uFE0F Yordam" }
      ]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
};
async function processTelegramUpdate(update) {
  const message = update.message;
  const callbackQuery = update.callback_query;
  const from = message?.from || callbackQuery?.from;
  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;
  if (!from || !chatId) return false;
  const telegramUserId = from.id;
  const supabase = getSupabase();
  let dbUser = null;
  if (supabase) {
    const { data } = await supabase.from("users").select(`
        id,
        telegram_user_id,
        customer_code,
        name,
        phone,
        onboarding_completed,
        onboarding_step,
        status,
        default_delivery_branch_id,
        default_branch:default_delivery_branch_id (provider, branch_name, region, address)
      `).eq("telegram_user_id", telegramUserId).single();
    dbUser = data;
    if (dbUser?.status === "blocked") {
      await sendTelegramMessage(chatId, "\u274C Sizning hisobingiz bloklangan. Iltimos, admin bilan bog'laning: @nothing_related");
      return true;
    }
  }
  let localUser = inMemoryUsers.get(telegramUserId);
  if (!localUser) {
    localUser = {
      id: `usr_mem_${telegramUserId}`,
      telegramUserId,
      customerCode: `YK-${nextCustomerCodeNum++}`,
      name: from.first_name || "Mijoz",
      phone: "",
      onboardingCompleted: false,
      onboardingStep: "oferta"
    };
    inMemoryUsers.set(telegramUserId, localUser);
  }
  const isCompleted = dbUser ? dbUser.onboarding_completed : localUser.onboardingCompleted;
  const customerCode = dbUser ? dbUser.customer_code : localUser.customerCode;
  const userName = dbUser ? dbUser.name : localUser.name;
  const userBranch = dbUser ? dbUser.default_branch : localUser.defaultBranch;
  const isAdmin = ADMIN_TELEGRAM_IDS3.includes(Number(telegramUserId));
  if (callbackQuery) {
    const data = callbackQuery.data;
    if (data === "oferta_accept") {
      localUser.onboardingStep = "phone";
      if (supabase) {
        const { data: activeOferta } = await supabase.from("oferta_versions").select("id").eq("is_active", true).single();
        if (!dbUser) {
          const { data: created } = await supabase.from("users").insert({
            telegram_user_id: telegramUserId,
            name: from.first_name || "Mijoz",
            phone: "pending",
            onboarding_step: "phone"
          }).select().single();
          dbUser = created;
        } else {
          await supabase.from("users").update({ onboarding_step: "phone" }).eq("id", dbUser.id);
        }
        if (dbUser && activeOferta) {
          await supabase.from("oferta_acceptances").insert({
            user_id: dbUser.id,
            telegram_user_id: telegramUserId,
            oferta_version_id: activeOferta.id
          });
        }
      }
      await sendTelegramMessage(
        chatId,
        '\u2705 Oferta shartlarini qabul qildingiz.\n\nIltimos, telefon raqamingizni tasdiqlash uchun pastdagi <b>"\u{1F4F1} Telefon raqamni yuborish"</b> tugmasini bosing:',
        {
          keyboard: [[{ text: "\u{1F4F1} Telefon raqamni yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      );
      return true;
    }
    if (data === "oferta_decline") {
      await sendTelegramMessage(chatId, "\u274C Siz ofertani qabul qilmadingiz. Yukla Go xizmatidan foydalanish uchun ofertaga rozilik berish zarur.");
      return true;
    }
    if (data?.startsWith("provider_")) {
      const provider = data.replace("provider_", "");
      localUser.selectedProvider = provider;
      localUser.onboardingStep = "region";
      let regions = [];
      if (supabase) {
        await supabase.from("users").update({ onboarding_step: "region" }).eq("id", dbUser?.id);
        const { data: branches } = await supabase.from("delivery_branches").select("region").eq("provider", provider).eq("active", true);
        regions = Array.from(new Set(branches?.map((b) => b.region) || []));
      }
      if (regions.length === 0) {
        regions = getRegionsForProvider(provider);
      }
      const buttons = [];
      for (let i = 0; i < regions.length; i += 2) {
        const row = [{ text: regions[i], callback_data: `reg_${provider}_${i}` }];
        if (regions[i + 1]) {
          row.push({ text: regions[i + 1], callback_data: `reg_${provider}_${i + 1}` });
        }
        buttons.push(row);
      }
      await sendTelegramMessage(chatId, `\u{1F4CD} <b>${provider}</b> uchun viloyatingizni tanlang:`, { inline_keyboard: buttons });
      return true;
    }
    if (data?.startsWith("reg_") || data?.startsWith("region_")) {
      let provider = "";
      let region = "";
      if (data.startsWith("reg_")) {
        const parts = data.split("_");
        provider = parts[1];
        const idx = parseInt(parts[2], 10);
        const provRegions = getRegionsForProvider(provider);
        region = provRegions[idx] || REGIONS_LIST[idx] || parts.slice(2).join("_");
      } else {
        const parts = data.split("_");
        provider = parts[1];
        region = parts.slice(2).join("_");
      }
      localUser.selectedRegion = region;
      localUser.onboardingStep = "branch";
      let branchesList = [];
      if (supabase) {
        await supabase.from("users").update({ onboarding_step: "branch" }).eq("id", dbUser?.id);
        const { data: branches } = await supabase.from("delivery_branches").select("id, branch_name").eq("provider", provider).eq("region", region).eq("active", true);
        branchesList = branches || [];
      }
      if (branchesList.length === 0) {
        branchesList = getBranches(provider, region).map((b) => ({
          id: b.id,
          branch_name: b.branchName
        }));
      }
      const buttons = branchesList.map((b) => [{ text: b.branch_name, callback_data: `branch_${b.id}` }]);
      await sendTelegramMessage(chatId, `\u{1F3E2} <b>${region}</b> bo'yicha filialni tanlang:`, { inline_keyboard: buttons });
      return true;
    }
    if (data?.startsWith("branch_")) {
      const branchId = data.replace("branch_", "");
      let chosenBranch = findBranchById(branchId) || ALL_BRANCHES[0];
      if (supabase && dbUser) {
        const { data: updated } = await supabase.from("users").update({
          default_delivery_branch_id: branchId,
          onboarding_completed: true,
          onboarding_step: "completed"
        }).eq("id", dbUser.id).select(`
            customer_code,
            name,
            default_branch:default_delivery_branch_id (provider, branch_name, region, address)
          `).single();
        if (updated) {
          dbUser = updated;
          chosenBranch = updated.default_branch;
        }
      }
      localUser.onboardingCompleted = true;
      localUser.onboardingStep = "completed";
      localUser.defaultBranch = {
        provider: chosenBranch.provider,
        branchName: chosenBranch.branch_name || chosenBranch.branchName,
        region: chosenBranch.region,
        address: chosenBranch.address
      };
      await sendTelegramMessage(
        chatId,
        `\u{1F389} <b>Tabriklaymiz, ro'yxatdan o'tish muvaffaqiyatli yakunlandi!</b>

\u{1F464} Sizning mijoz kodingiz: <code>${customerCode}</code>

Xitoy saytlarida (Taobao, 1688, Pinduoduo) xarid qilish uchun ombor manzilingiz:`,
        getMainKeyboard()
      );
      await sendWarehouseAddress(chatId, customerCode, supabase);
      return true;
    }
    if (data?.startsWith("add_track_")) {
      const trackToAdd = data.replace("add_track_", "").toUpperCase();
      let success = true;
      if (supabase && dbUser) {
        success = await addParcelToDatabase(dbUser, trackToAdd, supabase);
      }
      if (success) {
        await sendTelegramMessage(chatId, `\u2705 <code>${trackToAdd}</code> trek raqami hisobingizga muvaffaqiyatli qo'shildi!`);
      } else {
        await sendTelegramMessage(chatId, `\u26A0\uFE0F Ushbu trek raqam allaqachon ro'yxatdan o'tgan.`);
      }
      return true;
    }
  }
  const rawText = message?.text?.trim() || "";
  const textLower = rawText.toLowerCase();
  if (message?.contact) {
    const contact = message.contact;
    if (contact.user_id && contact.user_id !== telegramUserId) {
      await sendTelegramMessage(
        chatId,
        "\u26A0\uFE0F <b>Xavfsizlik ogohlantirishi:</b>\nIltimos, faqat o'zingizning shaxsiy telefon raqamingizni yuboring!"
      );
      return true;
    }
    let phone = contact.phone_number;
    if (!phone.startsWith("+")) phone = "+" + phone;
    localUser.phone = phone;
    localUser.onboardingStep = "name";
    if (supabase && dbUser) {
      await supabase.from("users").update({
        phone,
        phone_verified_at: (/* @__PURE__ */ new Date()).toISOString(),
        onboarding_step: "name"
      }).eq("id", dbUser.id);
    }
    await sendTelegramMessage(
      chatId,
      `\u2705 Telefon raqamingiz qabul qilindi: <b>${phone}</b>

Endi ism va familiyangizni kiriting:
<i>(Masalan: Saidislom Karimiy)</i>`,
      { remove_keyboard: true }
    );
    return true;
  }
  const currentStep = dbUser ? dbUser.onboarding_step : localUser.onboardingStep;
  if (currentStep === "name" && rawText && !rawText.startsWith("/")) {
    if (rawText.length < 3 || rawText.length > 60) {
      await sendTelegramMessage(chatId, "Iltimos, to'liq ismingizni kiriting (3 tadan 60 tagacha belgi):");
      return true;
    }
    localUser.name = rawText;
    localUser.onboardingCompleted = true;
    localUser.onboardingStep = "completed";
    if (supabase && dbUser) {
      await supabase.from("users").update({
        name: rawText,
        onboarding_completed: true,
        onboarding_step: "completed"
      }).eq("id", dbUser.id);
    }
    await sendTelegramMessage(
      chatId,
      `\u{1F389} <b>Tabriklaymiz, ${rawText}!</b>

Siz muvaffaqiyatli ro'yxatdan o'tdingiz!
\u{1F464} Sizning mijoz kodingiz: <code>${customerCode}</code>

Quyidagi menyu orqali ilovani yoki Video Darslarni ochishingiz mumkin:`,
      getMainKeyboard()
    );
    return true;
  }
  if (!isCompleted) {
    if (rawText === "/start") {
      if (isAdmin) {
        localUser.onboardingCompleted = true;
        localUser.onboardingStep = "completed";
        if (supabase && dbUser) {
          await supabase.from("users").update({
            onboarding_completed: true,
            onboarding_step: "completed"
          }).eq("id", dbUser.id);
        }
        await sendTelegramMessage(
          chatId,
          `\u{1F451} <b>Assalomu alaykum, Administrator!</b>

Siz tizimga administrator sifatida kirdingiz.
\u{1F464} ID: <code>${telegramUserId}</code> | Mijoz kodi: <code>${customerCode}</code>

Quyidagi menyu orqali kerakli bo'limni ochishingiz mumkin:
1\uFE0F\u20E3 <b>\u{1F393} Video darslar</b> \u2014 Foydalanuvchi interfeysi
2\uFE0F\u20E3 <b>\u2699\uFE0F Admin Dashboard</b> \u2014 Tizim va foydalanuvchilar boshqaruvi`,
          getAdminKeyboard()
        );
        return true;
      }
      localUser.onboardingStep = "oferta";
      const oferta = await getOfertaText();
      await sendTelegramMessage(
        chatId,
        `\u{1F4DC} <b>${oferta.title}</b>

${oferta.content}

<i>Xizmatdan foydalanish va ro'yxatdan o'tish uchun quyidagi tugma orqali oferta shartlarini qabul qiling:</i>`,
        {
          inline_keyboard: [
            [
              { text: "\u2705 Qabul qilaman", callback_data: "oferta_accept" },
              { text: "\u274C Rad etaman", callback_data: "oferta_decline" }
            ]
          ]
        }
      );
      return true;
    }
    if (currentStep === "oferta") {
      const oferta = await getOfertaText();
      await sendTelegramMessage(
        chatId,
        `Iltimos, avval oferta shartlarini qabul qiling:

\u{1F4DC} <b>${oferta.title}</b>`,
        {
          inline_keyboard: [
            [
              { text: "\u2705 Qabul qilaman", callback_data: "oferta_accept" },
              { text: "\u274C Rad etaman", callback_data: "oferta_decline" }
            ]
          ]
        }
      );
      return true;
    }
    if (currentStep === "phone") {
      await sendTelegramMessage(
        chatId,
        'Iltimos, telefon raqamingizni tasdiqlash uchun pastdagi <b>"\u{1F4F1} Telefon raqamni yuborish"</b> tugmasini bosing:',
        {
          keyboard: [[{ text: "\u{1F4F1} Telefon raqamni yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      );
      return true;
    }
  }
  if (textLower === "/academy" || textLower === "/kurs" || textLower === "/darslar" || textLower === "\u{1F393} video darslar") {
    const academyUrl = MINI_APP_URL2.includes("?") ? `${MINI_APP_URL2}&app=academy` : `${MINI_APP_URL2}?app=academy`;
    await sendTelegramMessage(
      chatId,
      `\u{1F393} <b>Yukla Go Akademiya \u2014 Video Darslar</b>

Xitoydan to'g'ri tovar buyurtma qilish bo'yicha bosqichma-bosqich amaliy darslar:

\u2705 1. Kirish: Xitoy karqo qanday ishlaydi?
\u25B6\uFE0F 2. Taobao va 1688 ilovalarida ro'yxatdan o'tish
\u{1F512} 3. Xitoy ombor manzilini to'g'ri kiritish
\u{1F512} 4. To'lov qilish va mahsulot sifatini tekshirish
\u{1F512} 5. Trek kodini kiritish va O'zbekistonda qabul qilish

<i>Darslar ketma-ketlikda ochiladi. Har bir darsni to'liq ko'rgach, keyingi dars ochiladi.</i>`,
      {
        inline_keyboard: [
          [{ text: "\u25B6\uFE0F Darslarni ochish (Mini App)", web_app: { url: academyUrl } }]
        ]
      }
    );
    return true;
  }
  if (isCompleted) {
    if (rawText === "/start") {
      if (isAdmin) {
        await sendTelegramMessage(
          chatId,
          `\u{1F451} <b>Assalomu alaykum, Administrator!</b>

Siz tizimga administrator sifatida kirdingiz.
\u{1F464} ID: <code>${telegramUserId}</code> | Mijoz kodi: <code>${customerCode}</code>

Quyidagi menyu orqali kerakli bo'limni ochishingiz mumkin:
1\uFE0F\u20E3 <b>\u{1F393} Video darslar</b> \u2014 Foydalanuvchi interfeysi
2\uFE0F\u20E3 <b>\u2699\uFE0F Admin Dashboard</b> \u2014 Tizim va darsliklar boshqaruvi`,
          getAdminKeyboard()
        );
        return true;
      }
      await sendTelegramMessage(
        chatId,
        `Assalomu alaykum, <b>${userName}</b>!

\u{1F464} Mijoz kodingiz: <code>${customerCode}</code>

Quyidagi menyu orqali Video darslarni ochishingiz mumkin:`,
        getMainKeyboard()
      );
      return true;
    }
    if (textLower === "/admin") {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, `\u26D4 <b>Ruxsat berilmagan:</b> Ushbu buyruq faqat administratorlar uchun mo'ljallangan.`);
        return true;
      }
      await sendTelegramMessage(
        chatId,
        `\u{1F451} <b>Admin Dashboard:</b>

Quyidagi tugma orqali boshqaruv panelini ochishingiz mumkin:`,
        {
          inline_keyboard: [
            [{ text: "\u2699\uFE0F Admin Dashboardni ochish", web_app: { url: `${MINI_APP_URL2}#admin` } }]
          ]
        }
      );
      return true;
    }
    if (textLower === "/address" || textLower === "/manzil" || textLower === "\u{1F1E8}\u{1F1F3} xitoy manzili") {
      await sendWarehouseAddress(chatId, customerCode, supabase);
      return true;
    }
    if (textLower === "/myid" || textLower === "/id" || textLower === "/kod" || textLower === "\u{1F464} mening profilim") {
      const phoneDisplay = dbUser?.phone || localUser.phone || "+998 90 123 45 67";
      await sendTelegramMessage(
        chatId,
        `\u{1F464} <b>Mening Profilim:</b>

Mijoz kodi: <code>${customerCode}</code>
F.I.SH: <b>${userName}</b>
Telefon: <code>${phoneDisplay}</code>

\u{1F4E6} <i>Tovarlaringiz O'zbekistonga yetib kelgach, administrator shaxsan sizga yetkazib beradi.</i>`,
        {
          inline_keyboard: [
            [{ text: "\u{1F393} Video darslarni ochish", web_app: { url: MINI_APP_URL2 } }]
          ]
        }
      );
      return true;
    }
    if (textLower === "/calculator" || textLower === "/kalkulyator") {
      await sendTelegramMessage(
        chatId,
        `\u{1F9EE} <b>Yetkazib berish narxini hisoblash:</b>

\u2708\uFE0F Aviatarif: <b>$9.5 / kg</b>
\u{1F4B5} Amaldagi kurs: <b>1 USD = 12,850 UZS</b>

Aniq hisob-kitob qilish uchun Yukla Go ilovasidagi kalkulyatordan foydalaning:`,
        {
          inline_keyboard: [
            [{ text: "\u{1F9EE} Kalkulyatorni ochish", web_app: { url: MINI_APP_URL2 } }]
          ]
        }
      );
      return true;
    }
    if (textLower === "/help" || textLower === "/yordam" || textLower === "\u260E\uFE0F yordam") {
      await sendTelegramMessage(
        chatId,
        `\u2753 <b>Qanday foydalaniladi?</b>

1\uFE0F\u20E3 <b>Xitoy manzilini oling:</b> <code>/address</code> orqali ombor manzilini ko'ring.
2\uFE0F\u20E3 <b>Xarid qiling:</b> Taobao, 1688 yoki Pinduoduo ilovalarida manzilga o'z kodingizni (<code>${customerCode}</code>) kiriting.
3\uFE0F\u20E3 <b>Trekni kiriting:</b> Buyurtma jo'natilgach, berilgan trek kodini botga yuboring yoki ilovaga qo'shing.
4\uFE0F\u20E3 <b>Kuzatib boring:</b> Yukingiz O'zbekistonga yetib kelguncha bot orqali avtomatik bildirishnoma olasiz.

Savollaringiz bormi? Admin: @nothing_related`,
        {
          inline_keyboard: [
            [{ text: "\u260E\uFE0F Admin bilan bog'lanish", url: "https://t.me/nothing_related" }],
            [{ text: "\u{1F4E6} Ilovani ochish", web_app: { url: MINI_APP_URL2 } }]
          ]
        }
      );
      return true;
    }
    if (textLower === "\u{1F50D} trek tekshirish") {
      await sendTelegramMessage(chatId, `\u{1F50D} Trek raqamini tekshirish uchun uni botga yuboring:
<i>(Masalan: YT882910291CN)</i>`);
      return true;
    }
    let trackingInput = rawText;
    if (trackingInput.startsWith("/track")) {
      trackingInput = trackingInput.replace("/track", "").trim();
    }
    if (trackingInput && /^[a-zA-Z0-9]{8,35}$/.test(trackingInput)) {
      const cleanTrack = trackingInput.toUpperCase();
      let foundParcel = null;
      if (supabase) {
        const { data } = await supabase.from("parcels").select("id, tracking_number, status, payment_status, amount, weight_kg, delivery_address_snapshot").eq("tracking_number", cleanTrack).single();
        foundParcel = data;
      }
      if (foundParcel) {
        const statusInfo = STATUS_MESSAGES[foundParcel.status] || { title: foundParcel.status, desc: "" };
        const weight = foundParcel.weight_kg ? `${foundParcel.weight_kg} kg` : "Kutilmoqda";
        const amount = foundParcel.amount ? `$${Number(foundParcel.amount).toFixed(2)}` : "Aniqlanmoqda";
        const branchSnap = foundParcel.delivery_address_snapshot;
        await sendTelegramMessage(
          chatId,
          `\u{1F4E6} <b>Yuk ma'lumotlari:</b>

Trek raqam: <code>${foundParcel.tracking_number}</code>
Holati: <b>${statusInfo.title}</b>
Vazni: <b>${weight}</b>
Narxi: <b>${amount}</b>
To'lov holati: <b>${foundParcel.payment_status === "paid" ? "\u2705 To'langan" : "\u23F3 To'lov kutilmoqda"}</b>
Yetkazish: <b>Admin orqali bevosita</b>

${statusInfo.desc}`,
          {
            inline_keyboard: [
              [{ text: "\u{1F4E6} Yukla Go ilovasida ko'rish", web_app: { url: MINI_APP_URL2 } }]
            ]
          }
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `\u{1F50E} <code>${cleanTrack}</code> trek raqami bo'yicha ma'lumot topilmadi.

Uni hisobingizga qo'shishni xohlaysizmi?`,
          {
            inline_keyboard: [
              [{ text: `\u2795 Ha, yuklarimga qo'shish`, callback_data: `add_track_${cleanTrack}` }]
            ]
          }
        );
      }
      return true;
    }
    await sendTelegramMessage(
      chatId,
      `Buyruq tushunarsiz bo'ldi. Trek raqamini yuboring yoki quyidagi menyudan foydalaning:`,
      getMainKeyboard()
    );
    return true;
  }
  return true;
}
async function sendWarehouseAddress(chatId, customerCode, supabase) {
  let receiver = `Yukla Go (${customerCode})`;
  let phone = "13335957161";
  let region = "\u6D59\u6C5F\u7701\u91D1\u534E\u5E02\u4E49\u4E4C\u5E02";
  let address = `077\u5E93\u623F/70099\u53F7 ${customerCode}`;
  if (supabase) {
    try {
      const { data: provider } = await supabase.from("cargo_providers").select("phone, province, city, district, full_address, warehouse_code, address_template").eq("active", true).single();
      if (provider) {
        phone = provider.phone;
        region = `${provider.province} ${provider.city}${provider.district ? " " + provider.district : ""}`;
        address = provider.address_template.replace("{warehouse_code}", provider.warehouse_code).replace("{customer_id}", customerCode);
      }
    } catch {
    }
  }
  const fullOneLine = `${receiver}\uFF0C${phone}\uFF0C${region} ${address}`;
  const message = `\u{1F1E8}\u{1F1F3} <b>Xitoydagi ombor manzilingiz:</b>

\u{1F464} <b>Qabul qiluvchi (\u6536\u4EF6\u4EBA):</b>
<code>${receiver}</code>

\u{1F4F1} <b>Telefon (\u624B\u673A\u53F7\u7801):</b>
<code>${phone}</code>

\u{1F4CD} <b>Hudud (\u6240\u5728\u5730\u533A):</b>
<code>${region}</code>

\u{1F3E2} <b>Batafsil manzil (\u8BE6\u7EC6\u5730\u5740):</b>
<code>${address}</code>

\u{1F4CB} <b>Bitta bosishda nusxalash (Taobao/1688 uchun):</b>
<code>${fullOneLine}</code>

\u{1F4A1} <i>Nusxalash uchun matn ustiga bir marta bosing. Taobao ilovasida manzil qo'shish oynasiga kirsangiz, avtomatik to'ldirish taklif qilinadi.</i>`;
  const keyboard = {
    inline_keyboard: [
      [{ text: "\u{1F4E6} Yukla Go ilovasini ochish", web_app: { url: MINI_APP_URL2 } }]
    ]
  };
  await sendTelegramMessage(chatId, message, keyboard);
}
async function addParcelToDatabase(user, trackingNumber, supabase) {
  try {
    const { data: existing } = await supabase.from("parcels").select("id").eq("tracking_number", trackingNumber).single();
    if (existing) return false;
    const { data: activeProvider } = await supabase.from("cargo_providers").select("id, phone, province, city, district, full_address, warehouse_code").eq("active", true).single();
    const branch = user.default_branch;
    const deliverySnapshot = branch ? {
      provider: branch.provider,
      branchName: branch.branch_name,
      region: branch.region,
      address: branch.address
    } : {
      provider: "Standard",
      branchName: "Standart filial",
      region: "O'zbekiston",
      address: "Markaziy ombor"
    };
    const cargoSnapshot = activeProvider ? {
      warehouseCode: activeProvider.warehouse_code,
      fullAddress: `${activeProvider.province} ${activeProvider.city} ${activeProvider.full_address}`,
      phone: activeProvider.phone
    } : {
      warehouseCode: "077\u5E93\u623F",
      fullAddress: "Zhejiang Jinhua Yiwu",
      phone: "13335957161"
    };
    const { data: newParcel, error } = await supabase.from("parcels").insert({
      user_id: user.id,
      tracking_number: trackingNumber,
      customer_code_snapshot: user.customer_code,
      cargo_provider_id: activeProvider?.id || null,
      cargo_address_snapshot: cargoSnapshot,
      delivery_branch_id: user.default_delivery_branch_id || null,
      delivery_address_snapshot: deliverySnapshot,
      status: "added",
      payment_status: "pending",
      amount: 0,
      currency: "USD",
      weight_kg: 0
    }).select().single();
    return !error && !!newParcel;
  } catch {
    return false;
  }
}

// api/_handlers/adminAcademy.ts
async function handler4(req, res) {
  const session = verifySessionToken(req.headers.authorization);
  if (session && session.role !== "admin" && session.role !== "super_admin") {
    return res.status(403).json({ error: "Ruxsat berilmagan" });
  }
  const { action, courseId = "course_cargo_101" } = req.query;
  if (req.method === "GET") {
    if (action === "access") {
      const accessList = getCourseAccessList(String(courseId));
      return res.status(200).json(accessList);
    }
    if (action === "students") {
      const allUsers = [...DEMO_ACADEMY_USERS];
      const botUsers = getInMemoryBotUsers();
      for (const bu of botUsers) {
        if (!allUsers.some((u) => u.id === bu.id || u.customerCode === bu.customerCode)) {
          allUsers.push({
            id: bu.id,
            name: bu.name,
            customerCode: bu.customerCode,
            telegramUserId: bu.telegramUserId
          });
        }
      }
      const summary = getStudentsProgressSummary(allUsers, String(courseId));
      return res.status(200).json(summary);
    }
    if (action === "lessons") {
      const list = STORED_LESSONS.filter((l) => l.courseId === String(courseId)).sort((a, b) => a.order - b.order);
      return res.status(200).json(list);
    }
    return res.status(200).json({
      courses: STORED_COURSES,
      lessons: STORED_LESSONS
    });
  }
  if (req.method === "POST") {
    const body = req.body || {};
    if (body.action === "grant_access") {
      const { identifier, userId, customerCode, courseId: targetCourseId = "course_cargo_101" } = body;
      const target = identifier || userId || customerCode;
      if (!target) return res.status(400).json({ error: "Foydalanuvchi identifikatori (ID yoki mijoz kodi) talab qilinadi" });
      const result = grantCourseAccess(target, String(targetCourseId));
      if (result.user?.telegramUserId) {
        try {
          const course = STORED_COURSES.find((c) => c.id === String(targetCourseId));
          const appUrl = process.env.MINI_APP_URL || "https://yuklago.vercel.app";
          const academyUrl = appUrl.includes("?") ? `${appUrl}&app=academy` : `${appUrl}?app=academy`;
          await sendTelegramMessage(
            result.user.telegramUserId,
            `\u{1F389} <b>Tabriklaymiz, ${result.user.name}!</b>

Sizga <b>${course?.title || "Video darslar"}</b> kursini tomosha qilish uchun ruxsat berildi!

Quyidagi tugma orqali darslarni hoziroq boshlashingiz mumkin:`,
            {
              inline_keyboard: [
                [{ text: "\u25B6\uFE0F Darslarni ochish (Mini App)", web_app: { url: academyUrl } }]
              ]
            }
          );
        } catch {
        }
      }
      return res.status(200).json({
        success: true,
        message: `${result.item?.name || target} ga darslarni ko'rish uchun ruxsat berildi!`,
        item: result.item
      });
    }
    if (body.action === "revoke_access") {
      const { identifier, userId, customerCode, courseId: targetCourseId = "course_cargo_101" } = body;
      const target = identifier || userId || customerCode;
      if (!target) return res.status(400).json({ error: "Foydalanuvchi identifikatori talab qilinadi" });
      const result = revokeCourseAccess(target, String(targetCourseId));
      return res.status(200).json({
        success: true,
        message: "Ruxsat bekor qilindi",
        item: result.item
      });
    }
    if (body.action === "reset_progress") {
      const { userId, courseId: targetCourseId } = body;
      if (!userId) return res.status(400).json({ error: "userId talab qilinadi" });
      resetStudentProgress(userId, targetCourseId);
      return res.status(200).json({
        success: true,
        message: "Talaba progressi muvaffaqiyatli qayta boshlandi"
      });
    }
    if (body.action === "add_lesson") {
      const { courseId: cId, title, youtubeUrlOrId, durationSeconds, description } = body;
      if (!cId || !title || !youtubeUrlOrId) {
        return res.status(400).json({ error: "courseId, title va youtubeUrlOrId talab qilinadi" });
      }
      const created = addLessonToCourse(cId, {
        title,
        youtubeUrlOrId,
        durationSeconds: Number(durationSeconds) || 360,
        description
      });
      return res.status(201).json({
        success: true,
        message: "Yangi dars muvaffaqiyatli qo'shildi",
        lesson: created
      });
    }
    if (body.action === "create_course") {
      const { title, description, icon, category } = body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: "Bo'lim / kurs nomi talab qilinadi" });
      }
      const created = addCourse({
        title,
        description,
        icon,
        category
      });
      return res.status(201).json({
        success: true,
        message: "Yangi bo'lim muvaffaqiyatli qo'shildi",
        course: created
      });
    }
    return res.status(400).json({ error: "Noma'lum amal" });
  }
  if (req.method === "DELETE") {
    const { lessonId, courseId: courseId2 } = req.query;
    if (courseId2) {
      const deleted2 = deleteCourse(String(courseId2));
      return res.status(200).json({
        success: deleted2,
        message: deleted2 ? "Bo'lim muvaffaqiyatli o'chirildi" : "Bo'lim topilmadi"
      });
    }
    if (!lessonId) return res.status(400).json({ error: "lessonId yoki courseId talab qilinadi" });
    const deleted = deleteLesson(String(lessonId));
    return res.status(200).json({
      success: deleted,
      message: deleted ? "Dars o'chirildi" : "Dars topilmadi"
    });
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// api/_handlers/adminCargoProviders.ts
async function handler5(req, res) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || session.role !== "admin" && session.role !== "super_admin") {
    return res.status(403).json({ error: "Ruxsat berilmagan" });
  }
  const supabase = getSupabase();
  if (req.method === "GET") {
    if (!supabase) {
      return res.status(200).json([
        {
          id: "cp_1",
          internal_name: "Main China Air Hub",
          receiver_name: "Yukla Go",
          phone: "13335957161",
          province: "Zhejiang",
          city: "Jinhua/Yiwu",
          full_address: "077\u5E93\u623F/70099\u53F7",
          warehouse_code: "077\u5E93\u623F/70099\u53F7",
          address_template: "{warehouse_code} {customer_id}",
          active: true
        }
      ]);
    }
    try {
      const { data, error } = await supabase.from("cargo_providers").select("*").order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: "Yuklashda xatolik" });
      return res.status(200).json(data || []);
    } catch (err) {
      return res.status(500).json({ error: "Xatolik" });
    }
  }
  if (req.method === "PATCH") {
    const { providerId, setActive, phone, province, city, warehouse_code, address_template, receiver_name } = req.body || {};
    if (!supabase) {
      return res.status(200).json({ success: true, message: "Ombor sozlamalari yangilandi" });
    }
    try {
      if (setActive !== void 0) {
        if (setActive) {
          await supabase.from("cargo_providers").update({ active: false }).neq("id", providerId);
          await supabase.from("cargo_providers").update({ active: true }).eq("id", providerId);
        } else {
          await supabase.from("cargo_providers").update({ active: false }).eq("id", providerId);
        }
      }
      const updateData = {};
      if (phone !== void 0) updateData.phone = phone;
      if (province !== void 0) updateData.province = province;
      if (city !== void 0) updateData.city = city;
      if (warehouse_code !== void 0) updateData.warehouse_code = warehouse_code;
      if (address_template !== void 0) updateData.address_template = address_template;
      if (receiver_name !== void 0) updateData.receiver_name = receiver_name;
      if (Object.keys(updateData).length > 0) {
        const targetId = providerId || (await supabase.from("cargo_providers").select("id").eq("active", true).single()).data?.id;
        if (targetId) {
          await supabase.from("cargo_providers").update(updateData).eq("id", targetId);
        }
      }
      await supabase.from("admin_audit_logs").insert({
        admin_telegram_id: session.telegramUserId,
        action: "UPDATE_CARGO_PROVIDER",
        entity_type: "cargo_providers",
        entity_id: providerId || "active",
        details: { setActive, ...updateData }
      });
      return res.status(200).json({ success: true, message: "Karqo ombori sozlamalari yangilandi" });
    } catch (err) {
      return res.status(500).json({ error: "Xatolik" });
    }
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// api/_handlers/adminLocationRequests.ts
async function handler6(req, res) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || session.role !== "admin" && session.role !== "super_admin") {
    return res.status(403).json({ error: "Ruxsat berilmagan" });
  }
  const supabase = getSupabase();
  if (req.method === "GET") {
    if (!supabase) {
      return res.status(200).json([]);
    }
    try {
      const { data: requests, error } = await supabase.from("delivery_change_requests").select(`
          id,
          user_id,
          status,
          created_at,
          user:users (customer_code, name, phone),
          old_branch:old_branch_id (provider, branch_name, region),
          requested_branch:requested_branch_id (provider, branch_name, region)
        `).order("created_at", { ascending: false });
      if (error) {
        return res.status(500).json({ error: "So'rovlarni yuklashda xatolik" });
      }
      return res.status(200).json(requests || []);
    } catch (err) {
      return res.status(500).json({ error: "Xatolik" });
    }
  }
  if (req.method === "PATCH") {
    const { requestId, status, note } = req.body || {};
    if (!requestId || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "requestId va status (approved/rejected) talab qilinadi" });
    }
    if (!supabase) {
      return res.status(200).json({ success: true, status });
    }
    try {
      const { data: request, error: reqError } = await supabase.from("delivery_change_requests").select("id, user_id, requested_branch_id, status").eq("id", requestId).single();
      if (reqError || !request) {
        return res.status(404).json({ error: "So'rov topilmadi" });
      }
      if (status === "approved") {
        await supabase.from("users").update({ default_delivery_branch_id: request.requested_branch_id }).eq("id", request.user_id);
      }
      await supabase.from("delivery_change_requests").update({
        status,
        reviewed_by: session.telegramUserId,
        admin_note: note || null,
        reviewed_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", requestId);
      await supabase.from("admin_audit_logs").insert({
        admin_telegram_id: session.telegramUserId,
        action: `LOCATION_REQUEST_${status.toUpperCase()}`,
        entity_type: "delivery_change_requests",
        entity_id: requestId,
        details: { userId: request.user_id, status, requestedBranchId: request.requested_branch_id }
      });
      try {
        const { data: userRec } = await supabase.from("users").select("telegram_user_id").eq("id", request.user_id).single();
        if (userRec?.telegram_user_id) {
          const msg = status === "approved" ? "\u2705 <b>Yetkazib berish manzilingiz muvaffaqiyatli o'zgartirildi!</b>\n\nYangi buyurtmalaringiz belgilangan yangi filialga yo'naltiriladi." : "\u26A0\uFE0F <b>Manzilni o'zgartirish so'rovingiz ma'qullanmadi.</b>\nBatafsil ma'lumot uchun admin bilan bog'laning: @nothing_related";
          sendTelegramMessage(userRec.telegram_user_id, msg).catch(() => {
          });
        }
      } catch {
      }
      return res.status(200).json({
        success: true,
        message: status === "approved" ? "Manzil o'zgartirish tasdiqlandi" : "Manzil so'rovi rad etildi"
      });
    } catch (err) {
      return res.status(500).json({ error: "Tizim xatosi" });
    }
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// api/_handlers/adminParcels.ts
async function handler7(req, res) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || session.role !== "admin" && session.role !== "super_admin") {
    return res.status(403).json({ error: "Ruxsat berilmagan" });
  }
  const supabase = getSupabase();
  if (req.method === "GET") {
    if (!supabase) {
      return res.status(200).json([]);
    }
    try {
      const { search, status, unsubmitted, limit = "100", offset = "0" } = req.query;
      let query = supabase.from("parcels").select(`
          id,
          tracking_number,
          customer_code_snapshot,
          status,
          payment_status,
          amount,
          currency,
          weight_kg,
          delivery_address_snapshot,
          cargo_address_snapshot,
          cargo_submitted_at,
          created_at
        `).order("created_at", { ascending: false }).range(parseInt(String(offset), 10), parseInt(String(offset), 10) + parseInt(String(limit), 10) - 1);
      if (status) {
        query = query.eq("status", String(status));
      }
      if (unsubmitted === "true") {
        query = query.is("cargo_submitted_at", null);
      }
      if (search) {
        const s = String(search).trim();
        query = query.or(`tracking_number.ilike.%${s}%,customer_code_snapshot.ilike.%${s}%`);
      }
      const { data: parcels, error } = await query;
      if (error) {
        return res.status(500).json({ error: "Yuklarni yuklashda xatolik" });
      }
      const formatted = (parcels || []).map((p) => ({
        id: p.id,
        trackingNumber: p.tracking_number,
        customerCode: p.customer_code_snapshot,
        status: p.status,
        paymentStatus: p.payment_status,
        weightKg: Number(p.weight_kg) || 0,
        amount: Number(p.amount) || 0,
        currency: p.currency,
        deliveryBranchSnapshot: p.delivery_address_snapshot,
        cargoAddressSnapshot: p.cargo_address_snapshot,
        cargoSubmittedAt: p.cargo_submitted_at,
        createdAt: p.created_at
      }));
      return res.status(200).json(formatted);
    } catch (err) {
      return res.status(500).json({ error: "Xatolik yuz berdi" });
    }
  }
  if (req.method === "PATCH") {
    const { action, parcelIds, value } = req.body || {};
    if (!Array.isArray(parcelIds) || parcelIds.length === 0) {
      return res.status(400).json({ error: "parcelIds massivi talab qilinadi" });
    }
    if (!supabase) {
      return res.status(200).json({ success: true, updatedCount: parcelIds.length });
    }
    try {
      let updatePayload = {};
      if (action === "status") {
        if (!["added", "china_warehouse", "in_transit", "uzbekistan", "delivered"].includes(value)) {
          return res.status(400).json({ error: "Noto'g'ri status" });
        }
        updatePayload.status = value;
      } else if (action === "payment") {
        if (!["pending", "paid"].includes(value)) {
          return res.status(400).json({ error: "Noto'g'ri to'lov holati" });
        }
        updatePayload.payment_status = value;
      } else if (action === "mark_submitted") {
        updatePayload.cargo_submitted_at = (/* @__PURE__ */ new Date()).toISOString();
      } else {
        return res.status(400).json({ error: "Noma'lum action" });
      }
      const { error: updateError } = await supabase.from("parcels").update(updatePayload).in("id", parcelIds);
      if (updateError) {
        return res.status(500).json({ error: "Yangilashda xatolik yuz berdi" });
      }
      await supabase.from("admin_audit_logs").insert({
        admin_telegram_id: session.telegramUserId,
        action: `BULK_${action.toUpperCase()}`,
        entity_type: "parcels",
        entity_id: parcelIds.join(","),
        details: { action, value, count: parcelIds.length }
      });
      if (action === "status") {
        try {
          const { data: affectedParcels } = await supabase.from("parcels").select("id, tracking_number, weight_kg, amount, users:user_id (telegram_user_id)").in("id", parcelIds);
          if (affectedParcels) {
            for (const ap of affectedParcels) {
              const tgId = ap.users?.telegram_user_id;
              if (tgId) {
                notifyParcelStatusUpdate(
                  tgId,
                  ap.tracking_number,
                  value,
                  Number(ap.weight_kg) || 0,
                  Number(ap.amount) || 0
                ).catch(() => {
                });
              }
            }
          }
        } catch {
        }
      }
      return res.status(200).json({
        success: true,
        updatedCount: parcelIds.length,
        message: `${parcelIds.length} ta yuk muvaffaqiyatli yangilandi`
      });
    } catch (err) {
      return res.status(500).json({ error: "Tizim xatoligi" });
    }
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// api/_lib/validation.ts
import { z } from "zod";
var TrackingNumberSchema = z.string().trim().min(4, "Trek raqami juda qisqa (kamida 4 ta belgi)").max(64, "Trek raqami juda uzun (ko'pi bilan 64 ta belgi)").regex(/^[A-Za-z0-9\-_]+$/, "Trek raqamida faqat lotin harflari va raqamlar bo'lishi kerak");
var AddParcelsPayloadSchema = z.object({
  trackingNumbers: z.array(TrackingNumberSchema).min(1, "Kamida bitta trek raqami kiriting").max(30, "Bitta so'rovda ko'pi bilan 30 ta trek kiritish mumkin")
});
var LocationRequestSchema = z.object({
  requestedBranchId: z.string().uuid("Filial ID formati noto'g'ri")
});
var BulkStatusUpdateSchema = z.object({
  parcelIds: z.array(z.string().uuid()).min(1),
  status: z.enum(["added", "china_warehouse", "in_transit", "uzbekistan", "delivered"])
});
var BulkPaymentUpdateSchema = z.object({
  parcelIds: z.array(z.string().uuid()).min(1),
  paymentStatus: z.enum(["pending", "paid"])
});
var MarkSubmittedSchema = z.object({
  parcelIds: z.array(z.string().uuid()).min(1)
});
var CargoProviderUpdateSchema = z.object({
  internalName: z.string().min(1),
  receiverName: z.string().min(1),
  phone: z.string().min(5),
  province: z.string().min(1),
  city: z.string().min(1),
  district: z.string().optional(),
  fullAddress: z.string().min(1),
  warehouseCode: z.string().min(1),
  addressTemplate: z.string().min(1),
  active: z.boolean()
});
var SettingsUpdateSchema = z.object({
  pricePerKg: z.number().positive(),
  exchangeRate: z.number().positive(),
  supportUsername: z.string().min(1),
  ofertaText: z.string().optional(),
  ofertaTitle: z.string().optional()
});

// api/_handlers/adminSettings.ts
async function handler8(req, res) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || session.role !== "admin" && session.role !== "super_admin") {
    return res.status(403).json({ error: "Ruxsat berilmagan" });
  }
  const supabase = getSupabase();
  const oferta = await getOfertaText();
  if (req.method === "GET") {
    if (!supabase) {
      return res.status(200).json({
        pricePerKg: 9.5,
        exchangeRate: 12850,
        supportUsername: "nothing_related",
        ofertaText: oferta.content,
        ofertaTitle: oferta.title
      });
    }
    try {
      const { data } = await supabase.from("app_settings").select("*");
      let pricePerKg = 9.5;
      let exchangeRate = 12850;
      let supportUsername = "nothing_related";
      data?.forEach((s) => {
        if (s.key === "cargo_rates") pricePerKg = s.value?.price_per_kg ?? 9.5;
        if (s.key === "exchange_rate") exchangeRate = s.value?.usd_to_uzs ?? 12850;
        if (s.key === "support_contact") supportUsername = s.value?.telegram_username ?? "nothing_related";
      });
      return res.status(200).json({
        pricePerKg,
        exchangeRate,
        supportUsername,
        ofertaText: oferta.content,
        ofertaTitle: oferta.title
      });
    } catch (err) {
      return res.status(500).json({ error: "Xatolik" });
    }
  }
  if (req.method === "PATCH") {
    const parsed = SettingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Noto'g'ri qiymatlar" });
    }
    const { pricePerKg, exchangeRate, supportUsername, ofertaText, ofertaTitle } = parsed.data;
    if (ofertaText) {
      await updateOfertaText(ofertaText, ofertaTitle);
    }
    if (!supabase) {
      return res.status(200).json({ success: true, message: "Sozlamalar saqlandi" });
    }
    try {
      await Promise.all([
        supabase.from("app_settings").upsert({
          key: "cargo_rates",
          value: { price_per_kg: pricePerKg, currency: "USD" },
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }),
        supabase.from("app_settings").upsert({
          key: "exchange_rate",
          value: { usd_to_uzs: exchangeRate },
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }),
        supabase.from("app_settings").upsert({
          key: "support_contact",
          value: { telegram_username: supportUsername },
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        })
      ]);
      await supabase.from("admin_audit_logs").insert({
        admin_telegram_id: session.telegramUserId,
        action: "UPDATE_SETTINGS",
        entity_type: "app_settings",
        entity_id: "global",
        details: { pricePerKg, exchangeRate, supportUsername, ofertaTitle }
      });
      return res.status(200).json({ success: true, message: "Sozlamalar saqlandi" });
    } catch (err) {
      return res.status(500).json({ error: "Xatolik" });
    }
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// api/_handlers/adminStats.ts
async function handler9(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = verifySessionToken(req.headers.authorization);
  if (!session || session.role !== "admin" && session.role !== "super_admin") {
    return res.status(403).json({ error: "Ruxsat berilmagan: Faqat administratorlar uchun" });
  }
  const supabase = getSupabase();
  if (!supabase) {
    const memUsers = getInMemoryBotUsers();
    return res.status(200).json({
      totalUsers: memUsers.length,
      activeParcels: 0,
      unsubmittedTracks: 0,
      pendingLocationRequests: 0,
      deliveredParcels: 0
    });
  }
  try {
    const [
      { count: totalUsers },
      { count: activeParcels },
      { count: unsubmittedTracks },
      { count: pendingLocationRequests },
      { count: deliveredParcels }
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("parcels").select("*", { count: "exact", head: true }).neq("status", "delivered"),
      supabase.from("parcels").select("*", { count: "exact", head: true }).is("cargo_submitted_at", null),
      supabase.from("delivery_change_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("parcels").select("*", { count: "exact", head: true }).eq("status", "delivered")
    ]);
    return res.status(200).json({
      totalUsers: totalUsers || 0,
      activeParcels: activeParcels || 0,
      unsubmittedTracks: unsubmittedTracks || 0,
      pendingLocationRequests: pendingLocationRequests || 0,
      deliveredParcels: deliveredParcels || 0
    });
  } catch (err) {
    return res.status(500).json({ error: "Xatolik yuz berdi" });
  }
}

// api/_handlers/adminUsers.ts
async function handler10(req, res) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || session.role !== "admin" && session.role !== "super_admin") {
    return res.status(403).json({ error: "Ruxsat berilmagan" });
  }
  const supabase = getSupabase();
  if (req.method === "GET") {
    if (!supabase) {
      return res.status(200).json([]);
    }
    try {
      const { search } = req.query;
      let query = supabase.from("users").select(`
          id,
          telegram_user_id,
          customer_code,
          name,
          phone,
          status,
          onboarding_completed,
          created_at,
          default_branch:default_delivery_branch_id (provider, branch_name, region)
        `).order("created_at", { ascending: false });
      if (search) {
        const s = String(search).trim();
        query = query.or(`customer_code.ilike.%${s}%,name.ilike.%${s}%,phone.ilike.%${s}%`);
      }
      const { data: users, error } = await query;
      if (error) {
        return res.status(500).json({ error: "Foydalanuvchilarni yuklashda xatolik" });
      }
      return res.status(200).json(users || []);
    } catch (err) {
      return res.status(500).json({ error: "Xatolik" });
    }
  }
  if (req.method === "PATCH") {
    const { userId, status } = req.body || {};
    if (!userId || !["active", "blocked"].includes(status)) {
      return res.status(400).json({ error: "userId va status (active/blocked) talab qilinadi" });
    }
    if (!supabase) {
      return res.status(200).json({ success: true });
    }
    try {
      await supabase.from("users").update({ status }).eq("id", userId);
      await supabase.from("admin_audit_logs").insert({
        admin_telegram_id: session.telegramUserId,
        action: `USER_STATUS_${status.toUpperCase()}`,
        entity_type: "users",
        entity_id: userId,
        details: { status }
      });
      return res.status(200).json({ success: true, message: `Foydalanuvchi holati: ${status}` });
    } catch (err) {
      return res.status(500).json({ error: "Xatolik" });
    }
  }
  if (req.method === "DELETE" || req.method === "POST" && req.body?.action === "wipe") {
    const userId = req.query?.userId || req.query?.id || req.body?.userId || req.body?.id;
    const customerCode = req.query?.customerCode || req.body?.customerCode;
    const telegramUserId = req.query?.telegramUserId || req.body?.telegramUserId;
    if (!userId && !customerCode && !telegramUserId) {
      return res.status(400).json({
        error: "Foydalanuvchi identifikatori (userId, customerCode yoki telegramUserId) talab qilinadi"
      });
    }
    if (telegramUserId) wipeBotUser(telegramUserId);
    if (customerCode) wipeBotUser(customerCode);
    if (userId) wipeBotUser(userId);
    if (userId) wipeAcademyUser(userId);
    if (customerCode) wipeAcademyUser(customerCode);
    if (supabase) {
      try {
        let targetUser = null;
        if (userId) {
          const { data } = await supabase.from("users").select("*").eq("id", userId).single();
          targetUser = data;
        } else if (customerCode) {
          const { data } = await supabase.from("users").select("*").eq("customer_code", customerCode.toUpperCase()).single();
          targetUser = data;
        } else if (telegramUserId) {
          const { data } = await supabase.from("users").select("*").eq("telegram_user_id", Number(telegramUserId)).single();
          targetUser = data;
        }
        const effectiveUserId = targetUser?.id || userId;
        const effectiveCustomerCode = targetUser?.customer_code || customerCode;
        const effectiveTgId = targetUser?.telegram_user_id || telegramUserId;
        if (effectiveCustomerCode) {
          await supabase.from("parcels").delete().eq("customer_code", effectiveCustomerCode);
        }
        if (effectiveUserId) {
          await supabase.from("parcels").delete().eq("user_id", effectiveUserId);
          await supabase.from("location_requests").delete().eq("user_id", effectiveUserId);
          await supabase.from("oferta_acceptances").delete().eq("user_id", effectiveUserId);
          await supabase.from("academy_progress").delete().eq("user_id", effectiveUserId);
          await supabase.from("academy_access").delete().eq("user_id", effectiveUserId);
          await supabase.from("users").delete().eq("id", effectiveUserId);
        }
        await supabase.from("admin_audit_logs").insert({
          admin_telegram_id: session.telegramUserId,
          action: "USER_FULL_WIPE",
          entity_type: "users",
          entity_id: effectiveUserId || "unknown",
          details: { customerCode: effectiveCustomerCode, telegramUserId: effectiveTgId }
        });
      } catch (err) {
        console.error("Supabase user wipe error:", err);
      }
    }
    return res.status(200).json({
      success: true,
      message: `Mijoz (${customerCode || userId || telegramUserId}) va uning barcha ma'lumotlari (bot tarixi, yuklari, darslari) butunlay o'chirildi (Full Wipe).`
    });
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// api/_lib/rateLimiter.ts
var rateLimitStore = /* @__PURE__ */ new Map();
function checkRateLimit(key, maxRequests, windowSeconds) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  if (!record || now > record.resetAt) {
    const newRecord = {
      count: 1,
      resetAt: now + windowSeconds * 1e3
    };
    rateLimitStore.set(key, newRecord);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInSeconds: windowSeconds
    };
  }
  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil((record.resetAt - now) / 1e3)
    };
  }
  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetInSeconds: Math.ceil((record.resetAt - now) / 1e3)
  };
}
function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

// api/_handlers/authSession.ts
async function handler11(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`auth:${ip}`, 15, 60);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: "Juda ko'p so'rov yuborildi. Birozdan so'ng qayta urinib ko'ring." });
  }
  const { initData } = req.body || {};
  if (!initData) {
    return res.status(400).json({ error: "Telegram initData talab qilinadi" });
  }
  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: validation.error || "Telegram autentifikatsiyasi tasdiqlanmadi" });
  }
  const tgUser = validation.user;
  const supabase = getSupabase();
  if (!supabase) {
    const sessionToken = createSessionToken({
      userId: `usr_dev_${tgUser.id}`,
      telegramUserId: tgUser.id,
      customerCode: "YK-100",
      role: "customer"
    });
    return res.status(200).json({
      token: sessionToken,
      user: {
        telegramUserId: tgUser.id,
        customerCode: "YK-100",
        name: tgUser.first_name,
        role: "customer"
      },
      devMode: true
    });
  }
  try {
    const { data: user, error: userError } = await supabase.from("users").select("id, telegram_user_id, customer_code, name, status, onboarding_completed").eq("telegram_user_id", tgUser.id).single();
    if (userError || !user) {
      return res.status(403).json({
        error: "Foydalanuvchi topilmadi. Iltimos, Telegram botimizda ro'yxatdan o'ting.",
        needsOnboarding: true
      });
    }
    if (user.status === "blocked") {
      return res.status(403).json({ error: "Sizning hisobingiz bloklangan. Administrator bilan bog'laning." });
    }
    if (!user.onboarding_completed) {
      return res.status(403).json({
        error: "Ro'yxatdan o'tish yakunlanmagan. Iltimos, botda ro'yxatdan o'tishni yakunlang.",
        needsOnboarding: true
      });
    }
    let role = "customer";
    if (isTelegramAdmin(tgUser.id)) {
      role = "super_admin";
    } else {
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("telegram_user_id", tgUser.id).single();
      if (roleData?.role) {
        role = roleData.role;
      }
    }
    const token = createSessionToken({
      userId: user.id,
      telegramUserId: user.telegram_user_id,
      customerCode: user.customer_code,
      role
    });
    return res.status(200).json({
      token,
      user: {
        id: user.id,
        telegramUserId: user.telegram_user_id,
        customerCode: user.customer_code,
        name: user.name,
        role
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Tizimda xatolik yuz berdi. Qayta urinib ko'ring." });
  }
}

// api/_handlers/botWebhook.ts
var WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
async function handler12(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (WEBHOOK_SECRET) {
    const receivedSecret = req.headers["x-telegram-bot-api-secret-token"];
    if (receivedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Invalid secret token" });
    }
  }
  const update = req.body;
  if (!update) {
    return res.status(200).json({ ok: true });
  }
  try {
    await processTelegramUpdate(update);
  } catch (err) {
    console.error("Webhook update handling error:", err);
  }
  return res.status(200).json({ ok: true });
}

// api/_handlers/branches.ts
async function handler13(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { provider, region } = req.query;
  const supabase = getSupabase();
  if (!supabase) {
    const list = getBranches(
      provider ? String(provider) : void 0,
      region ? String(region) : void 0
    ).map((b) => ({
      ...b,
      branch_name: b.branchName
    }));
    return res.status(200).json(list);
  }
  try {
    let query = supabase.from("delivery_branches").select("id, provider, provider_branch_code, region, district, city, branch_name, address, phone").eq("active", true).order("region", { ascending: true }).order("branch_name", { ascending: true });
    if (provider) {
      query = query.eq("provider", String(provider).toUpperCase());
    }
    if (region) {
      query = query.eq("region", String(region));
    }
    const { data: branches, error } = await query;
    if (error || !branches || branches.length === 0) {
      const list = getBranches(
        provider ? String(provider) : void 0,
        region ? String(region) : void 0
      ).map((b) => ({
        ...b,
        branch_name: b.branchName
      }));
      return res.status(200).json(list);
    }
    return res.status(200).json(branches);
  } catch (err) {
    const list = getBranches(
      provider ? String(provider) : void 0,
      region ? String(region) : void 0
    ).map((b) => ({
      ...b,
      branch_name: b.branchName
    }));
    return res.status(200).json(list);
  }
}

// api/_handlers/configRates.ts
async function handler14(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      pricePerKg: 9.5,
      exchangeRate: 12850
    });
  }
  try {
    const { data: settings } = await supabase.from("app_settings").select("key, value");
    let pricePerKg = 9.5;
    let exchangeRate = 12850;
    settings?.forEach((item) => {
      if (item.key === "cargo_rates") {
        pricePerKg = item.value?.price_per_kg ?? 9.5;
      }
      if (item.key === "exchange_rate") {
        exchangeRate = item.value?.usd_to_uzs ?? 12850;
      }
    });
    return res.status(200).json({
      pricePerKg,
      exchangeRate
    });
  } catch (err) {
    return res.status(200).json({
      pricePerKg: 9.5,
      exchangeRate: 12850
    });
  }
}

// api/_handlers/configWarehouse.ts
async function handler15(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    return res.status(401).json({ error: "Avtorizatsiyadan o'tilmagan" });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      receiver: `Yukla Go (${session.customerCode})`,
      phone: "13335957161",
      region: "\u6D59\u6C5F\u7701\u91D1\u534E\u5E02\u4E49\u4E4C\u5E02",
      address: `077\u5E93\u623F/70099\u53F7 ${session.customerCode}`,
      customerCode: session.customerCode
    });
  }
  try {
    const { data: provider, error } = await supabase.from("cargo_providers").select("phone, province, city, district, full_address, warehouse_code, address_template").eq("active", true).single();
    if (error || !provider) {
      return res.status(500).json({ error: "Faol ombor sozlamalari topilmadi" });
    }
    const region = `${provider.province} ${provider.city}${provider.district ? " " + provider.district : ""}`;
    const address = provider.address_template.replace("{warehouse_code}", provider.warehouse_code).replace("{customer_id}", session.customerCode);
    return res.status(200).json({
      receiver: `Yukla Go (${session.customerCode})`,
      phone: provider.phone,
      region,
      address,
      customerCode: session.customerCode
    });
  } catch (err) {
    return res.status(500).json({ error: "Xatolik yuz berdi" });
  }
}

// api/_handlers/parcels.ts
async function handler16(req, res) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    return res.status(401).json({ error: "Avtorizatsiyadan o'tilmagan" });
  }
  const supabase = getSupabase();
  if (req.method === "GET") {
    if (!supabase) {
      return res.status(200).json([]);
    }
    try {
      const { data: parcels, error } = await supabase.from("parcels").select(`
          id,
          tracking_number,
          customer_code_snapshot,
          status,
          payment_status,
          amount,
          currency,
          weight_kg,
          image_url,
          delivery_address_snapshot,
          cargo_address_snapshot,
          cargo_submitted_at,
          created_at
        `).eq("user_id", session.userId).order("created_at", { ascending: false });
      if (error) {
        return res.status(500).json({ error: "Yuklarni yuklashda xatolik" });
      }
      const formatted = (parcels || []).map((p) => ({
        id: p.id,
        trackingNumber: p.tracking_number,
        customerCode: p.customer_code_snapshot,
        status: p.status,
        paymentStatus: p.payment_status,
        weightKg: Number(p.weight_kg) || 0,
        amount: Number(p.amount) || 0,
        currency: p.currency,
        imageUrl: p.image_url,
        deliveryBranchSnapshot: p.delivery_address_snapshot,
        cargoAddressSnapshot: p.cargo_address_snapshot,
        cargoSubmittedAt: p.cargo_submitted_at,
        createdAt: p.created_at
      }));
      return res.status(200).json(formatted);
    } catch (err) {
      return res.status(500).json({ error: "Xatolik yuz berdi" });
    }
  }
  if (req.method === "POST") {
    const rateLimit = checkRateLimit(`track:${session.userId}`, 25, 60);
    if (!rateLimit.allowed) {
      return res.status(429).json({ error: "Juda ko'p so'rov yuborildi. Iltimos, bir daqiqadan so'ng urinib ko'ring." });
    }
    const body = req.body || {};
    let trackList = [];
    if (typeof body.trackingNumber === "string") {
      trackList = [body.trackingNumber];
    } else if (Array.isArray(body.trackingNumbers)) {
      trackList = body.trackingNumbers;
    }
    const parsed = AddParcelsPayloadSchema.safeParse({ trackingNumbers: trackList });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Noto'g'ri trek formati" });
    }
    const trackingNumbers = parsed.data.trackingNumbers;
    if (!supabase) {
      return res.status(200).json({
        success: true,
        message: `${trackingNumbers.length} ta trek muvaffaqiyatli qo'shildi (Dev Mode)`
      });
    }
    try {
      const { data: user } = await supabase.from("users").select(`
          default_delivery_branch_id,
          delivery_branches:default_delivery_branch_id (
            id, provider, branch_name, region, district, address, phone
          )
        `).eq("id", session.userId).single();
      const branch = user?.delivery_branches;
      const deliverySnapshot = branch ? {
        provider: branch.provider,
        branchName: branch.branch_name,
        region: branch.region,
        district: branch.district,
        address: branch.address,
        phone: branch.phone
      } : {
        provider: "Standard",
        branchName: "Standart yetkazish",
        region: "O'zbekiston",
        address: "Markaziy ombor"
      };
      const { data: activeProvider } = await supabase.from("cargo_providers").select("id, phone, province, city, district, full_address, warehouse_code").eq("active", true).single();
      const cargoSnapshot = activeProvider ? {
        warehouseCode: activeProvider.warehouse_code,
        fullAddress: `${activeProvider.province} ${activeProvider.city} ${activeProvider.full_address}`,
        phone: activeProvider.phone
      } : {
        warehouseCode: "077\u5E93\u623F",
        fullAddress: "Zhejiang Jinhua Yiwu",
        phone: "13335957161"
      };
      const results = [];
      const duplicateErrors = [];
      for (const rawTrack of trackingNumbers) {
        const cleanTrack = rawTrack.toUpperCase();
        const { data: existing } = await supabase.from("parcels").select("id").eq("tracking_number", cleanTrack).single();
        if (existing) {
          duplicateErrors.push(cleanTrack);
          continue;
        }
        const { data: newParcel, error: insertError } = await supabase.from("parcels").insert({
          user_id: session.userId,
          tracking_number: cleanTrack,
          customer_code_snapshot: session.customerCode,
          cargo_provider_id: activeProvider?.id || null,
          cargo_address_snapshot: cargoSnapshot,
          delivery_branch_id: user?.default_delivery_branch_id || null,
          delivery_address_snapshot: deliverySnapshot,
          status: "added",
          payment_status: "pending",
          amount: 0,
          currency: "USD",
          weight_kg: 0
        }).select().single();
        if (!insertError && newParcel) {
          results.push(newParcel);
        }
      }
      if (results.length === 0 && duplicateErrors.length > 0) {
        return res.status(409).json({
          error: "Ushbu trek raqam(lar) allaqachon tizimga kiritilgan."
        });
      }
      return res.status(201).json({
        success: true,
        addedCount: results.length,
        duplicatesCount: duplicateErrors.length,
        message: `${results.length} ta trek muvaffaqiyatli saqlandi.${duplicateErrors.length > 0 ? ` (${duplicateErrors.length} ta dublikat o'tkazib yuborildi)` : ""}`
      });
    } catch (err) {
      return res.status(500).json({ error: "Tizim xatoligi yuz berdi" });
    }
  }
  return res.status(405).json({ error: "Method not allowed" });
}

// api/_handlers/userLocationRequest.ts
async function handler17(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    return res.status(401).json({ error: "Avtorizatsiyadan o'tilmagan" });
  }
  const rateLimit = checkRateLimit(`loc:${session.userId}`, 5, 600);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: "Juda ko'p so'rov yuborildi. Keyinroq urinib ko'ring." });
  }
  const parsed = LocationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot" });
  }
  const { requestedBranchId } = parsed.data;
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ success: true, message: "So'rov yuborildi (Dev Mode)" });
  }
  try {
    const { data: user } = await supabase.from("users").select("default_delivery_branch_id").eq("id", session.userId).single();
    const { data: newBranch } = await supabase.from("delivery_branches").select("id").eq("id", requestedBranchId).eq("active", true).single();
    if (!newBranch) {
      return res.status(400).json({ error: "Tanlangan filial mavjud emas yoki faol emas" });
    }
    const { data: request, error: insertError } = await supabase.from("delivery_change_requests").insert({
      user_id: session.userId,
      old_branch_id: user?.default_delivery_branch_id || null,
      requested_branch_id: requestedBranchId,
      status: "pending"
    }).select().single();
    if (insertError) {
      return res.status(500).json({ error: "So'rovni saqlashda xatolik yuz berdi" });
    }
    return res.status(200).json({
      success: true,
      message: "Yetkazib berish manzilini o'zgartirish so'rovi yuborildi. Administrator tasdiqlashini kuting.",
      requestId: request.id
    });
  } catch (err) {
    return res.status(500).json({ error: "Tizim xatosi" });
  }
}

// api/_handlers/userMe.ts
async function handler18(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    return res.status(401).json({ error: "Avtorizatsiyadan o'tilmagan" });
  }
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      id: session.userId,
      telegramUserId: session.telegramUserId,
      customerCode: session.customerCode,
      name: "Saidislom",
      phone: "+998 90 123 45 67",
      status: "active",
      defaultDeliveryBranch: {
        provider: "BTS",
        branchName: "BTS Chorsu",
        region: "Namangan",
        address: "Namangan sh., Chorsu dahasi, 12-uy"
      }
    });
  }
  try {
    const { data: user, error } = await supabase.from("users").select(`
        id,
        telegram_user_id,
        customer_code,
        name,
        phone,
        status,
        default_delivery_branch:delivery_branches (
          id,
          provider,
          branch_name,
          region,
          district,
          address,
          phone
        )
      `).eq("id", session.userId).single();
    if (error || !user) {
      return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
    }
    if (user.status === "blocked") {
      return res.status(403).json({ error: "Hisobingiz bloklangan" });
    }
    return res.status(200).json({
      id: user.id,
      telegramUserId: user.telegram_user_id,
      customerCode: user.customer_code,
      name: user.name,
      phone: user.phone,
      status: user.status,
      defaultDeliveryBranch: user.default_delivery_branch
    });
  } catch (err) {
    return res.status(500).json({ error: "Xatolik yuz berdi" });
  }
}

// api/_router.ts
async function handler19(req, res) {
  const rawUrl = req.url || "";
  const urlObj = new URL(rawUrl, "http://localhost");
  let pathname = urlObj.pathname.replace(/\/$/, "");
  const pathParam = req.query?.__path;
  const normalizedPath = (pathname === "/api" || pathname === "") && pathParam ? `/api/${String(pathParam).replace(/^\//, "").split("?")[0]}` : pathname;
  switch (normalizedPath) {
    case "/api/bot/webhook":
      return handler12(req, res);
    case "/api/auth/session":
      return handler11(req, res);
    case "/api/user/me":
      return handler18(req, res);
    case "/api/user/location-request":
      return handler17(req, res);
    case "/api/config/warehouse":
      return handler15(req, res);
    case "/api/config/rates":
      return handler14(req, res);
    case "/api/branches":
      return handler13(req, res);
    case "/api/parcels":
      return handler16(req, res);
    case "/api/academy/courses":
      return handler(req, res);
    case "/api/academy/progress":
      return handler2(req, res);
    case "/api/academy/request-access":
      return handler3(req, res);
    case "/api/admin/academy":
      return handler4(req, res);
    case "/api/admin/cargo-providers":
      return handler5(req, res);
    case "/api/admin/location-requests":
      return handler6(req, res);
    case "/api/admin/parcels":
      return handler7(req, res);
    case "/api/admin/settings":
      return handler8(req, res);
    case "/api/admin/stats":
      return handler9(req, res);
    case "/api/admin/users":
      return handler10(req, res);
    default:
      return res.status(404).json({
        error: "API endpoint topilmadi",
        path: normalizedPath
      });
  }
}
export {
  handler19 as default
};
