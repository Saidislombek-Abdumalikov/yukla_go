// api/_lib/auth.ts
import crypto from "crypto";
import jwt from "jsonwebtoken";
var DEFAULT_ADMIN_TELEGRAM_IDS = [7232597769, 5059829001];
function loadAdminIds() {
  const fromEnv = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  return Array.from(/* @__PURE__ */ new Set([...DEFAULT_ADMIN_TELEGRAM_IDS, ...fromEnv]));
}
var ADMIN_TELEGRAM_IDS = loadAdminIds();
function isTelegramAdmin(telegramUserId) {
  if (!telegramUserId) return false;
  const numId = Number(telegramUserId);
  return ADMIN_TELEGRAM_IDS.includes(numId);
}
function validateTelegramInitData(initData, maxAgeSeconds = 86400, tokenOverride) {
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
    if (isNaN(authDate) || maxAgeSeconds > 0 && now - authDate > maxAgeSeconds || authDate > now + 300) {
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
function getJwtSecret() {
  const secret = process.env.JWT_SECRET || "";
  if (secret.length < 32) {
    throw new Error("JWT_SECRET is missing or shorter than 32 characters");
  }
  return secret;
}
function createSessionToken(payload, expiresIn = "7d") {
  return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256", expiresIn });
}
function verifySessionToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (!decoded || typeof decoded.telegramUserId !== "number" || !decoded.userId) return null;
    return decoded;
  } catch {
    return null;
  }
}
function isAdminSession(session) {
  return Boolean(session && (session.role === "admin" || session.role === "super_admin"));
}

// api/_lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
var clientInstance = null;
var override = null;
var getSupabase = () => {
  if (override) return override;
  if (clientInstance) return clientInstance;
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (url && key) {
    clientInstance = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    return clientInstance;
  }
  return null;
};

// api/_lib/academyStore.ts
var StoreError = class extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};
var DEFAULT_COURSE_ID = "course_cargo_101";
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
function db() {
  const supabase = getSupabase();
  if (!supabase) throw new StoreError("Ma'lumotlar bazasi sozlanmagan", 503);
  return supabase;
}
function check(res) {
  if (res.error) {
    console.error("Academy DB error:", res.error.message || res.error);
    throw new StoreError("Ma'lumotlar bazasida xatolik", 500);
  }
  return res.data;
}
function assertId(value, label = "ID") {
  const v = String(value ?? "");
  if (!ID_RE.test(v)) throw new StoreError(`${label} noto'g'ri`, 400);
  return v;
}
function mapUser(u) {
  return {
    id: u.id,
    name: u.name || "Mijoz",
    customerCode: u.customer_code || "",
    telegramUserId: Number(u.telegram_user_id),
    status: u.status || "active"
  };
}
async function getActiveUser(userId, telegramUserId) {
  if (!UUID_RE.test(userId)) throw new StoreError("Sessiya yaroqsiz, qayta kiring", 401);
  const row = check(await db().from("users").select("id, name, customer_code, telegram_user_id, status").eq("id", userId).maybeSingle());
  if (!row || Number(row.telegram_user_id) !== Number(telegramUserId)) {
    throw new StoreError("Foydalanuvchi topilmadi", 401);
  }
  if (row.status === "blocked") throw new StoreError("Hisobingiz bloklangan", 403);
  return mapUser(row);
}
async function resolveUser(identifier) {
  const clean = String(identifier || "").trim().slice(0, 80);
  if (!clean) return null;
  const cols = "id, name, customer_code, telegram_user_id, status";
  const num = Number(clean);
  let q = db().from("users").select(cols);
  if (UUID_RE.test(clean)) q = q.eq("id", clean);
  else if (Number.isInteger(num) && num > 1e5) q = q.eq("telegram_user_id", num);
  else if (/^YK-/i.test(clean)) q = q.eq("customer_code", clean.toUpperCase());
  else q = q.ilike("name", `%${clean.replace(/[%_\\]/g, "")}%`).limit(1);
  const rows = check(await q);
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row ? mapUser(row) : null;
}
async function getAccessStatus(userId, courseId) {
  const row = check(
    await db().from("academy_access").select("status").eq("user_id", userId).eq("course_id", courseId).maybeSingle()
  );
  return row?.status || "none";
}
async function requestAccess(user, courseId) {
  const course = check(await db().from("academy_courses").select("id").eq("id", courseId).maybeSingle());
  if (!course) throw new StoreError("Kurs topilmadi", 404);
  const current = await getAccessStatus(user.id, courseId);
  const requestedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (current === "none") {
    check(await db().from("academy_access").upsert(
      { user_id: user.id, course_id: courseId, status: "pending", requested_at: requestedAt },
      { onConflict: "user_id,course_id" }
    ));
  }
  return {
    userId: user.id,
    customerCode: user.customerCode,
    name: user.name,
    telegramUserId: user.telegramUserId,
    courseId,
    status: current === "none" ? "pending" : current,
    requestedAt
  };
}
async function grantAccess(user, courseId, adminTelegramId) {
  const course = check(await db().from("academy_courses").select("id").eq("id", courseId).maybeSingle());
  if (!course) throw new StoreError("Kurs topilmadi", 404);
  const grantedAt = (/* @__PURE__ */ new Date()).toISOString();
  check(await db().from("academy_access").upsert(
    { user_id: user.id, course_id: courseId, status: "granted", granted_at: grantedAt, granted_by: adminTelegramId },
    { onConflict: "user_id,course_id" }
  ));
  return {
    userId: user.id,
    customerCode: user.customerCode,
    name: user.name,
    telegramUserId: user.telegramUserId,
    courseId,
    status: "granted",
    grantedAt
  };
}
async function revokeAccess(user, courseId) {
  check(await db().from("academy_access").delete().eq("user_id", user.id).eq("course_id", courseId));
  return {
    userId: user.id,
    customerCode: user.customerCode,
    name: user.name,
    telegramUserId: user.telegramUserId,
    courseId,
    status: "none"
  };
}
async function listAccess(courseId) {
  const users = check(
    await db().from("users").select("id, name, customer_code, telegram_user_id, status").order("created_at", { ascending: false }).limit(2e3)
  );
  const rows = check(
    await db().from("academy_access").select("user_id, status, granted_at, requested_at").eq("course_id", courseId)
  );
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  return users.map((u) => {
    const r = byUser.get(u.id);
    return {
      userId: u.id,
      customerCode: u.customer_code || "",
      name: u.name || "Mijoz",
      telegramUserId: Number(u.telegram_user_id),
      courseId,
      status: r?.status || "none",
      grantedAt: r?.granted_at || void 0,
      requestedAt: r?.requested_at || void 0
    };
  });
}
async function listCoursesForUser(userId) {
  const courses = check(
    await db().from("academy_courses").select("*").eq("active", true).order("order", { ascending: true })
  );
  const lessons = check(await db().from("academy_lessons").select("id, course_id"));
  const progress = check(
    await db().from("academy_user_progress").select("lesson_id, completed").eq("user_id", userId).eq("completed", true)
  );
  const done = new Set(progress.map((p) => p.lesson_id));
  return courses.map((c) => {
    const own = lessons.filter((l) => l.course_id === c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description || "",
      category: c.category,
      icon: c.icon || "\u{1F4DA}",
      order: c.order,
      lessonsCount: own.length,
      completedLessonsCount: own.filter((l) => done.has(l.id)).length
    };
  });
}
async function getLessonsForUser(userId, courseId) {
  const lessons = check(
    await db().from("academy_lessons").select("*").eq("course_id", courseId).order("order", { ascending: true })
  );
  const ids = lessons.map((l) => l.id);
  const progress = ids.length ? check(await db().from("academy_user_progress").select("lesson_id, max_watched_seconds, last_position_seconds, completed").eq("user_id", userId).in("lesson_id", ids)) : [];
  const byLesson = new Map(progress.map((p) => [p.lesson_id, p]));
  let previousCompleted = true;
  return lessons.map((l) => {
    const rec = byLesson.get(l.id);
    const isCompleted = rec?.completed === true;
    const isLocked = !previousCompleted;
    previousCompleted = isCompleted;
    return {
      id: l.id,
      courseId: l.course_id,
      order: l.order,
      title: l.title,
      description: l.description || "",
      youtubeVideoId: isLocked ? "" : l.youtube_video_id,
      durationSeconds: l.duration_seconds,
      isLocked,
      isCompleted,
      maxWatchedSeconds: rec?.max_watched_seconds || 0,
      lastPositionSeconds: rec?.last_position_seconds || 0
    };
  });
}
async function recordProgress(user, lessonId, reportedSeconds, clientReportedCompleted = false, bypassAccess = false) {
  assertId(lessonId, "lessonId");
  if (!Number.isFinite(reportedSeconds)) throw new StoreError("watchedSeconds noto'g'ri", 400);
  const lesson = check(
    await db().from("academy_lessons").select("id, course_id, duration_seconds").eq("id", lessonId).maybeSingle()
  );
  if (!lesson) throw new StoreError("Dars topilmadi", 404);
  if (!bypassAccess && await getAccessStatus(user.id, lesson.course_id) !== "granted") {
    throw new StoreError("Ushbu kursga ruxsat yo'q", 403);
  }
  const lessons = await getLessonsForUser(user.id, lesson.course_id);
  const target = lessons.find((l) => l.id === lessonId);
  if (!target || target.isLocked) throw new StoreError("Bu dars hali ochilmagan", 403);
  const existing = check(
    await db().from("academy_user_progress").select("max_watched_seconds, completed, last_sync_timestamp").eq("user_id", user.id).eq("lesson_id", lessonId).maybeSingle()
  );
  const now = Date.now();
  const duration = lesson.duration_seconds;
  let maxWatched = existing?.max_watched_seconds || 0;
  const lastSync = existing?.last_sync_timestamp ? new Date(existing.last_sync_timestamp).getTime() : now - 5e3;
  const elapsedRealSec = Math.max(1, (now - lastSync) / 1e3);
  const allowedMaxJump = Math.max(15, elapsedRealSec * 1.5 + 10);
  const targetWatched = Math.max(0, Math.min(reportedSeconds, duration));
  if (targetWatched > maxWatched) {
    maxWatched = targetWatched - maxWatched > allowedMaxJump && !existing?.completed ? Math.min(duration, maxWatched + allowedMaxJump) : targetWatched;
  }
  const wasCompleted = existing?.completed === true;
  const isCompleted = wasCompleted || maxWatched >= duration * 0.95 || clientReportedCompleted && maxWatched >= duration * 0.85;
  const row = {
    user_id: user.id,
    lesson_id: lessonId,
    max_watched_seconds: Math.floor(maxWatched),
    last_position_seconds: Math.floor(targetWatched),
    completed: isCompleted,
    last_sync_timestamp: new Date(now).toISOString()
  };
  check(await db().from("academy_user_progress").upsert(row, { onConflict: "user_id,lesson_id" }));
  return {
    success: true,
    progress: {
      userId: user.id,
      lessonId,
      maxWatchedSeconds: row.max_watched_seconds,
      lastPositionSeconds: row.last_position_seconds,
      completed: isCompleted,
      updatedAt: row.last_sync_timestamp
    },
    unlockedNextLesson: isCompleted && !wasCompleted
  };
}
function extractYouTubeId(input) {
  if (!input) return "";
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (match?.[1]) return match[1];
  return "";
}
async function getCourseTitle(courseId) {
  const row = check(await db().from("academy_courses").select("title").eq("id", courseId).maybeSingle());
  return row?.title || null;
}
async function listAllContent() {
  const courses = check(
    await db().from("academy_courses").select("*").order("order", { ascending: true })
  );
  const lessons = check(
    await db().from("academy_lessons").select("*").order("order", { ascending: true })
  );
  return {
    courses: courses.map((c) => ({ ...c, description: c.description || "" })),
    lessons: lessons.map((l) => ({
      id: l.id,
      courseId: l.course_id,
      order: l.order,
      title: l.title,
      description: l.description || "",
      youtubeVideoId: l.youtube_video_id,
      durationSeconds: l.duration_seconds
    }))
  };
}
var rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
async function addCourse(data) {
  const title = String(data.title || "").trim().slice(0, 150);
  if (!title) throw new StoreError("Bo'lim nomi talab qilinadi", 400);
  const existing = check(await db().from("academy_courses").select("*"));
  const order = existing.reduce((m, c) => Math.max(m, c.order || 0), 0) + 1;
  const course = {
    id: `course_${rid()}`,
    title,
    description: String(data.description || "").trim().slice(0, 1e3),
    icon: String(data.icon || "\u{1F4DA}").trim().slice(0, 8),
    category: String(data.category || "general").trim().slice(0, 40),
    order
  };
  check(await db().from("academy_courses").insert(course));
  return course;
}
async function deleteCourse(courseId) {
  assertId(courseId, "courseId");
  const found = check(await db().from("academy_courses").select("id").eq("id", courseId).maybeSingle());
  if (!found) return false;
  check(await db().from("academy_courses").delete().eq("id", courseId));
  return true;
}
async function addLesson(courseId, data) {
  assertId(courseId, "courseId");
  const course = check(await db().from("academy_courses").select("id").eq("id", courseId).maybeSingle());
  if (!course) throw new StoreError("Kurs topilmadi", 404);
  const videoId = extractYouTubeId(data.youtubeUrlOrId);
  if (!videoId) throw new StoreError("YouTube havolasi yoki video ID noto'g'ri", 400);
  const title = String(data.title || "").trim().slice(0, 200);
  if (!title) throw new StoreError("Dars nomi talab qilinadi", 400);
  const duration = Math.min(86400, Math.max(10, Math.floor(Number(data.durationSeconds) || 360)));
  const existing = check(await db().from("academy_lessons").select("*").eq("course_id", courseId));
  const order = existing.reduce((m, l) => Math.max(m, l.order || 0), 0) + 1;
  const row = {
    id: `les_${rid()}`,
    course_id: courseId,
    order,
    title,
    description: String(data.description || "").trim().slice(0, 2e3),
    youtube_video_id: videoId,
    duration_seconds: duration
  };
  check(await db().from("academy_lessons").insert(row));
  return { id: row.id, courseId, order, title, description: row.description, youtubeVideoId: videoId, durationSeconds: duration };
}
async function deleteLesson(lessonId) {
  assertId(lessonId, "lessonId");
  const found = check(await db().from("academy_lessons").select("id").eq("id", lessonId).maybeSingle());
  if (!found) return false;
  check(await db().from("academy_lessons").delete().eq("id", lessonId));
  return true;
}
async function studentsSummary(courseId) {
  const lessons = check(
    await db().from("academy_lessons").select("*").eq("course_id", courseId).order("order", { ascending: true })
  );
  const access = check(await db().from("academy_access").select("user_id").eq("course_id", courseId).eq("status", "granted"));
  const ids = access.map((a) => a.user_id);
  if (!ids.length) return [];
  const users = check(await db().from("users").select("id, name, customer_code").in("id", ids));
  const lessonIds = lessons.map((l) => l.id);
  const progress = lessonIds.length ? check(await db().from("academy_user_progress").select("user_id, lesson_id, max_watched_seconds, completed").in("user_id", ids).in("lesson_id", lessonIds)) : [];
  return users.map((u) => {
    let completedCount = 0;
    const detail = lessons.map((l) => {
      const rec = progress.find((p) => p.user_id === u.id && p.lesson_id === l.id);
      const completed = rec?.completed === true;
      if (completed) completedCount++;
      const maxW = rec?.max_watched_seconds || 0;
      const pct2 = Math.min(100, Math.round(maxW / (l.duration_seconds || 1) * 100));
      return {
        lessonId: l.id,
        title: l.title,
        order: l.order,
        completed,
        isCompleted: completed,
        watchedPercent: pct2,
        percentage: pct2,
        durationSeconds: l.duration_seconds,
        maxWatchedSeconds: maxW
      };
    });
    const total = lessons.length;
    const pct = total ? Math.round(completedCount / total * 100) : 0;
    return {
      userId: u.id,
      name: u.name || "Mijoz",
      customerCode: u.customer_code || "",
      completedCount,
      completedLessonsCount: completedCount,
      totalLessons: total,
      progressPercent: pct,
      completionPercentage: pct,
      lessons: detail
    };
  });
}
async function resetProgress(userId, courseId) {
  if (!UUID_RE.test(userId)) throw new StoreError("userId noto'g'ri", 400);
  if (courseId) {
    const lessons = check(await db().from("academy_lessons").select("id").eq("course_id", courseId));
    const ids = lessons.map((l) => l.id);
    if (ids.length) check(await db().from("academy_user_progress").delete().eq("user_id", userId).in("lesson_id", ids));
  } else {
    check(await db().from("academy_user_progress").delete().eq("user_id", userId));
  }
}

// api/_lib/guard.ts
function sendError(res, err) {
  if (err instanceof StoreError) return res.status(err.status).json({ error: err.message });
  console.error("Unhandled API error:", err);
  return res.status(500).json({ error: "Serverda xatolik yuz berdi" });
}
async function requireUser(req, res) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    res.status(401).json({ error: "Kirish talab qilinadi" });
    return null;
  }
  try {
    const user = await getActiveUser(session.userId, session.telegramUserId);
    return { session, user, isAdmin: isAdminSession(session) };
  } catch (err) {
    sendError(res, err);
    return null;
  }
}
function requireAdmin(req, res) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    res.status(401).json({ error: "Kirish talab qilinadi" });
    return null;
  }
  if (!isAdminSession(session)) {
    res.status(403).json({ error: "Ruxsat berilmagan" });
    return null;
  }
  return session;
}
async function audit(session, action, entityType, entityId, details = {}) {
  try {
    await getSupabase()?.from("admin_audit_logs").insert({
      admin_telegram_id: session.telegramUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    });
  } catch {
  }
}

// api/_handlers/academyCourses.ts
async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await requireUser(req, res);
  if (!auth) return;
  try {
    const { courseId } = req.query;
    if (courseId) {
      const cId = assertId(courseId, "courseId");
      const status = auth.isAdmin ? "granted" : await getAccessStatus(auth.user.id, cId);
      if (status !== "granted") {
        return res.status(200).json({
          hasAccess: false,
          accessStatus: status,
          lessons: [],
          message: "Ushbu darslarni ko'rish uchun administrator ruxsati talab qilinadi."
        });
      }
      const lessons = await getLessonsForUser(auth.user.id, cId);
      return res.status(200).json({ hasAccess: true, accessStatus: "granted", lessons });
    }
    return res.status(200).json(await listCoursesForUser(auth.user.id));
  } catch (err) {
    return sendError(res, err);
  }
}

// api/_handlers/academyProgress.ts
async function handler2(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await requireUser(req, res);
  if (!auth) return;
  const { lessonId, watchedSeconds, completed = false } = req.body || {};
  if (!lessonId || typeof watchedSeconds !== "number") {
    return res.status(400).json({ error: "lessonId va watchedSeconds talab qilinadi" });
  }
  try {
    const result = await recordProgress(auth.user, String(lessonId), watchedSeconds, Boolean(completed), auth.isAdmin);
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
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
  const auth = await requireUser(req, res);
  if (!auth) return;
  const { courseId } = req.body || {};
  if (!courseId) {
    return res.status(400).json({ error: "courseId talab qilinadi" });
  }
  try {
    const cId = assertId(courseId, "courseId");
    const item = await requestAccess(auth.user, cId);
    if (item.status === "pending") {
      const title = await getCourseTitle(cId) || cId;
      for (const adminId of ADMIN_TELEGRAM_IDS) {
        await sendTelegramMessage(
          adminId,
          `\u{1F514} <b>Yangi darslik so'rovi!</b>

\u{1F464} Talaba: <b>${escapeHtml(item.name)}</b> (<code>${escapeHtml(item.customerCode)}</code>)
\u{1F4DA} Kurs: <b>${escapeHtml(title)}</b>

<i>Admin panel orqali "Ruxsat berish" tugmasini bosib tasdiqlashingiz mumkin.</i>`
        ).catch(() => {
        });
      }
    }
    return res.status(200).json({
      success: true,
      message: item.status === "granted" ? "Sizda bu kursga ruxsat allaqachon bor." : "So'rovingiz qabul qilindi. Administrator tez orada tasdiqlaydi.",
      item
    });
  } catch (err) {
    return sendError(res, err);
  }
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// api/_handlers/adminAcademy.ts
async function handler4(req, res) {
  const session = requireAdmin(req, res);
  if (!session) return;
  try {
    const action = req.query?.action;
    const courseId = assertId(req.query?.courseId || DEFAULT_COURSE_ID, "courseId");
    if (req.method === "GET") {
      if (action === "access") return res.status(200).json(await listAccess(courseId));
      if (action === "students") return res.status(200).json(await studentsSummary(courseId));
      const content = await listAllContent();
      if (action === "lessons") {
        return res.status(200).json(content.lessons.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order));
      }
      return res.status(200).json(content);
    }
    if (req.method === "POST") {
      const body = req.body || {};
      if (body.action === "grant_access" || body.action === "revoke_access") {
        const target = body.identifier || body.userId || body.customerCode;
        if (!target) return res.status(400).json({ error: "Foydalanuvchi identifikatori (ID yoki mijoz kodi) talab qilinadi" });
        const cId = assertId(body.courseId || DEFAULT_COURSE_ID, "courseId");
        const user = await resolveUser(String(target));
        if (!user) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });
        if (body.action === "revoke_access") {
          const item2 = await revokeAccess(user, cId);
          await audit(session, "ACADEMY_REVOKE", "academy_access", user.id, { courseId: cId });
          return res.status(200).json({ success: true, message: "Ruxsat bekor qilindi", item: item2 });
        }
        const item = await grantAccess(user, cId, session.telegramUserId);
        await audit(session, "ACADEMY_GRANT", "academy_access", user.id, { courseId: cId });
        const title = await getCourseTitle(cId) || "Video darslar";
        const appUrl = process.env.MINI_APP_URL || "https://yuklago.vercel.app";
        const academyUrl = appUrl.includes("?") ? `${appUrl}&app=academy` : `${appUrl}?app=academy`;
        await sendTelegramMessage(
          user.telegramUserId,
          `\u{1F389} <b>Tabriklaymiz!</b>

Sizga <b>${escapeHtml2(title)}</b> kursini tomosha qilish uchun ruxsat berildi!

Quyidagi tugma orqali darslarni hoziroq boshlashingiz mumkin:`,
          { inline_keyboard: [[{ text: "\u25B6\uFE0F Darslarni ochish (Mini App)", web_app: { url: academyUrl } }]] }
        ).catch(() => {
        });
        return res.status(200).json({
          success: true,
          message: `${user.name} ga darslarni ko'rish uchun ruxsat berildi!`,
          item
        });
      }
      if (body.action === "reset_progress") {
        if (!body.userId) return res.status(400).json({ error: "userId talab qilinadi" });
        await resetProgress(String(body.userId), body.courseId ? assertId(body.courseId, "courseId") : void 0);
        await audit(session, "ACADEMY_RESET", "academy_progress", String(body.userId), { courseId: body.courseId });
        return res.status(200).json({ success: true, message: "Talaba progressi muvaffaqiyatli qayta boshlandi" });
      }
      if (body.action === "add_lesson") {
        const { courseId: cId, title, youtubeUrlOrId, durationSeconds, description } = body;
        if (!cId || !title || !youtubeUrlOrId) {
          return res.status(400).json({ error: "courseId, title va youtubeUrlOrId talab qilinadi" });
        }
        const lesson = await addLesson(String(cId), { title, youtubeUrlOrId, durationSeconds, description });
        await audit(session, "ACADEMY_ADD_LESSON", "academy_lessons", lesson.id, { courseId: cId });
        return res.status(201).json({ success: true, message: "Yangi dars muvaffaqiyatli qo'shildi", lesson });
      }
      if (body.action === "create_course") {
        const course = await addCourse({
          title: body.title,
          description: body.description,
          icon: body.icon,
          category: body.category
        });
        await audit(session, "ACADEMY_ADD_COURSE", "academy_courses", course.id);
        return res.status(201).json({ success: true, message: "Yangi bo'lim muvaffaqiyatli qo'shildi", course });
      }
      return res.status(400).json({ error: "Noma'lum amal" });
    }
    if (req.method === "DELETE") {
      const { lessonId, courseId: delCourseId } = req.query;
      if (delCourseId) {
        const deleted2 = await deleteCourse(String(delCourseId));
        if (deleted2) await audit(session, "ACADEMY_DELETE_COURSE", "academy_courses", String(delCourseId));
        return res.status(200).json({ success: deleted2, message: deleted2 ? "Bo'lim muvaffaqiyatli o'chirildi" : "Bo'lim topilmadi" });
      }
      if (!lessonId) return res.status(400).json({ error: "lessonId yoki courseId talab qilinadi" });
      const deleted = await deleteLesson(String(lessonId));
      if (deleted) await audit(session, "ACADEMY_DELETE_LESSON", "academy_lessons", String(lessonId));
      return res.status(200).json({ success: deleted, message: deleted ? "Dars o'chirildi" : "Dars topilmadi" });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return sendError(res, err);
  }
}
function escapeHtml2(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

// api/_lib/branchesData.ts
var REGIONS_LIST = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Andijon viloyati",
  "Farg'ona viloyati",
  "Namangan viloyati"
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
  { id: "uzp_nam_chust", provider: "UZPOST", branchName: "UzPost Chust Markaz", region: "Namangan viloyati", address: "Tinchlik ko'chasi 1" }
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
var ADMIN_TELEGRAM_IDS2 = ADMIN_TELEGRAM_IDS;
var getMainInlineKeyboard = (customerCode, name, telegramUserId, userId) => {
  let tokenParam = "";
  if (telegramUserId) {
    try {
      const token = createSessionToken({
        userId: userId || `usr_${telegramUserId}`,
        telegramUserId,
        customerCode: customerCode || "YK-100",
        role: isTelegramAdmin(telegramUserId) ? "admin" : "customer"
      }, "30d");
      tokenParam = `&token=${encodeURIComponent(token)}`;
    } catch {
    }
  }
  const query = customerCode ? `?code=${encodeURIComponent(customerCode)}${name ? `&name=${encodeURIComponent(name)}` : ""}${userId ? `&u=${encodeURIComponent(userId)}` : ""}${tokenParam}` : "";
  const personalAppUrl = `${MINI_APP_URL2}${query}`;
  return {
    inline_keyboard: [
      [{ text: "\u{1F680} Platformaga kirish", url: personalAppUrl }]
    ]
  };
};
var getAdminInlineKeyboard = (customerCode, name, telegramUserId, userId) => {
  return getMainInlineKeyboard(customerCode, name, telegramUserId, userId);
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
      `).eq("telegram_user_id", telegramUserId).maybeSingle();
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
  const isAdmin = ADMIN_TELEGRAM_IDS2.includes(Number(telegramUserId));
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
        "\u2705 Oferta shartlarini qabul qildingiz.\n\nIltimos, telefon raqamingizni yozib yuboring:\n<i>(Masalan: +998901234567)</i>",
        { remove_keyboard: true }
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
        getMainInlineKeyboard(customerCode, dbUser?.name || localUser.name)
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
    if (data === "cmd_profile") {
      const phoneDisplay = dbUser?.phone || localUser.phone || "Kiritilmagan";
      const personalUrl = `${MINI_APP_URL2}?code=${encodeURIComponent(customerCode)}&name=${encodeURIComponent(userName)}`;
      await sendTelegramMessage(
        chatId,
        `\u{1F464} <b>Mening Profilim:</b>

Mijoz kodi: <code>${customerCode}</code>
F.I.SH: <b>${userName}</b>
Telefon: <code>${phoneDisplay}</code>

\u{1F4E6} <i>Tovarlaringiz O'zbekistonga yetib kelgach, administrator shaxsan sizga yetkazib beradi.</i>`,
        {
          inline_keyboard: [
            [{ text: `\u{1F4F1} Shaxsiy hisobim (${customerCode})`, web_app: { url: personalUrl } }],
            [{ text: "\u{1F393} Video darslar", web_app: { url: `${personalUrl}&app=academy` } }]
          ]
        }
      );
      return true;
    }
    if (data === "cmd_address") {
      await sendWarehouseAddress(chatId, customerCode, supabase);
      return true;
    }
    if (data === "cmd_help") {
      const personalUrl = `${MINI_APP_URL2}?code=${encodeURIComponent(customerCode)}&name=${encodeURIComponent(userName)}`;
      await sendTelegramMessage(
        chatId,
        `\u2753 <b>Qanday foydalaniladi?</b>

1\uFE0F\u20E3 <b>Xitoy manzilini oling:</b> Ombor manzilini "\u{1F1E8}\u{1F1F3} Xitoy manzili" tugmasi orqali ko'ring.
2\uFE0F\u20E3 <b>Xarid qiling:</b> Taobao, 1688 yoki Pinduoduo ilovalarida manzilga o'z kodingizni (<code>${customerCode}</code>) kiriting.
3\uFE0F\u20E3 <b>Trekni kiriting:</b> Buyurtma jo'natilgach, berilgan trek kodini botga yuboring yoki ilovaga qo'shing.
4\uFE0F\u20E3 <b>Kuzatib boring:</b> Yukingiz O'zbekistonga yetib kelguncha bot orqali avtomatik bildirishnoma olasiz.

Savollaringiz bormi? Admin: @nothing_related`,
        {
          inline_keyboard: [
            [{ text: "\u260E\uFE0F Admin bilan bog'lanish", url: "https://t.me/nothing_related" }],
            [{ text: `\u{1F4F1} Shaxsiy hisobim (${customerCode})`, web_app: { url: personalUrl } }]
          ]
        }
      );
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

Endi to'liq ism va familiyangizni kiriting:
<i>(Masalan: Saidislombek Abdumalikov)</i>`,
      { remove_keyboard: true }
    );
    return true;
  }
  const currentStep = dbUser ? dbUser.onboarding_step : localUser.onboardingStep;
  if (currentStep === "phone" && rawText && !rawText.startsWith("/")) {
    const cleanedDigits = rawText.replace(/\D/g, "");
    let formattedPhone = "";
    if (cleanedDigits.length === 9) {
      formattedPhone = `+998${cleanedDigits}`;
    } else if (cleanedDigits.length === 12 && cleanedDigits.startsWith("998")) {
      formattedPhone = `+${cleanedDigits}`;
    } else if (cleanedDigits.length >= 7 && cleanedDigits.length <= 15) {
      formattedPhone = `+${cleanedDigits}`;
    }
    if (!formattedPhone) {
      await sendTelegramMessage(
        chatId,
        "\u26A0\uFE0F <b>Telefon raqam noto'g'ri kiritildi:</b>\nIltimos, raqamingizni to'liq yozib yuboring:\n<i>(Masalan: +998901234567)</i>",
        { remove_keyboard: true }
      );
      return true;
    }
    localUser.phone = formattedPhone;
    localUser.onboardingStep = "name";
    if (supabase && dbUser) {
      await supabase.from("users").update({
        phone: formattedPhone,
        phone_verified_at: (/* @__PURE__ */ new Date()).toISOString(),
        onboarding_step: "name"
      }).eq("id", dbUser.id);
    }
    await sendTelegramMessage(
      chatId,
      `\u2705 Telefon raqamingiz qabul qilindi: <b>${formattedPhone}</b>

Endi to'liq ism va familiyangizni kiriting:
<i>(Masalan: Saidislombek Abdumalikov)</i>`,
      { remove_keyboard: true }
    );
    return true;
  }
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

Siz Yukla Go tizimidan muvaffaqiyatli ro'yxatdan o'tdingiz!
\u{1F464} Sizning shaxsiy mijoz kodingiz: <code>${customerCode}</code>

Quyidagi havola tugmasi orqali shaxsiy o\u2018quv kabinetingizga kiring:`,
      getMainInlineKeyboard(customerCode, rawText, telegramUserId, dbUser?.id)
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
          `Assalomu alaykum!

Sizning mijoz kodingiz: <code>${customerCode}</code>

Shaxsiy hisobingizga kirish uchun quyidagi havola tugmasini bosing:`,
          getMainInlineKeyboard(customerCode, "Administrator", telegramUserId, dbUser?.id)
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
        "Iltimos, telefon raqamingizni yozib yuboring:\n<i>(Masalan: +998901234567)</i>",
        { remove_keyboard: true }
      );
      return true;
    }
    if (textLower === "/academy" || textLower === "/kurs" || textLower === "/darslar" || textLower === "\u{1F393} video darslar") {
      await sendTelegramMessage(
        chatId,
        "\u26A0\uFE0F <b>Video darslarni ko'rish uchun avval ro'yxatdan o'ting!</b>\n\nIltimos, /start buyrug'ini yuboring va ro'yxatdan o'tishni yakunlang."
      );
      return true;
    }
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
1\uFE0F\u20E3 <b>\u2699\uFE0F Admin Dashboard</b> \u2014 Tizim va foydalanuvchilar boshqaruvi
2\uFE0F\u20E3 <b>\u{1F393} Video darslar</b> \u2014 Foydalanuvchi interfeysi`,
          getAdminInlineKeyboard()
        );
        return true;
      }
      await sendTelegramMessage(
        chatId,
        `Assalomu alaykum, <b>${userName}</b>!

\u{1F464} Sizning shaxsiy mijoz kodingiz: <code>${customerCode}</code>

Shaxsiy o\u2018quv kabinetingizga kirish uchun quyidagi havola tugmasini bosing:`,
        getMainInlineKeyboard(customerCode, userName, telegramUserId, dbUser?.id)
      );
      return true;
    }
    if (textLower === "/academy" || textLower === "/kurs" || textLower === "/darslar" || textLower === "\u{1F393} video darslar") {
      await sendTelegramMessage(
        chatId,
        `\u{1F393} <b>Yukla Go \u2014 Video Darslar</b>

\u{1F464} Shaxsiy mijoz kodingiz: <code>${customerCode}</code>

Quyidagi havola orqali darslarni davom ettiring:`,
        getMainInlineKeyboard(customerCode, userName, telegramUserId, dbUser?.id)
      );
      return true;
    }
    if (textLower === "/myid" || textLower === "/id" || textLower === "/kod") {
      const phoneDisplay = dbUser?.phone || localUser.phone || "Kiritilmagan";
      const personalUrl = `${MINI_APP_URL2}?code=${encodeURIComponent(customerCode)}&name=${encodeURIComponent(userName)}`;
      await sendTelegramMessage(
        chatId,
        `\u{1F464} <b>Mening Profilim:</b>

Mijoz kodi: <code>${customerCode}</code>
F.I.SH: <b>${userName}</b>
Telefon: <code>${phoneDisplay}</code>

Shaxsiy kabinetingizga kirish uchun quyidagi havola tugmasini bosing:`,
        {
          inline_keyboard: [
            [{ text: "\u{1F680} Kabinetga kirish", url: personalUrl }]
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
        const personalAppUrl = `${MINI_APP_URL2}?code=${encodeURIComponent(customerCode)}&name=${encodeURIComponent(userName)}`;
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
              [{ text: `\u{1F4E6} Shaxsiy hisobimda ko'rish (${customerCode})`, web_app: { url: personalAppUrl } }]
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
      getMainInlineKeyboard(customerCode, userName)
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
  const personalAppUrl = `${MINI_APP_URL2}?code=${encodeURIComponent(customerCode)}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: `\u{1F4F1} Shaxsiy hisobim (${customerCode})`, web_app: { url: personalAppUrl } }]
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
      const { data: allRoles } = await supabase.from("user_roles").select("telegram_user_id, role");
      const roleMap = new Map((allRoles || []).map((r) => [r.telegram_user_id, r.role]));
      const enriched = (users || []).map((u) => ({
        ...u,
        role: roleMap.get(u.telegram_user_id) || (ADMIN_TELEGRAM_IDS.includes(Number(u.telegram_user_id)) ? "super_admin" : "customer")
      }));
      return res.status(200).json(enriched);
    } catch (err) {
      return res.status(500).json({ error: "Xatolik" });
    }
  }
  if (req.method === "PATCH") {
    const { userId, status, role, telegramUserId } = req.body || {};
    if (!userId && !telegramUserId) {
      return res.status(400).json({ error: "userId yoki telegramUserId talab qilinadi" });
    }
    if (!supabase) {
      return res.status(200).json({ success: true });
    }
    try {
      let tgId = telegramUserId;
      if (!tgId && userId) {
        const { data: u } = await supabase.from("users").select("telegram_user_id").eq("id", userId).maybeSingle();
        tgId = u?.telegram_user_id;
      }
      if (status && ["active", "blocked"].includes(status)) {
        await supabase.from("users").update({ status }).eq("id", userId);
        await supabase.from("admin_audit_logs").insert({
          admin_telegram_id: session.telegramUserId,
          action: `USER_STATUS_${status.toUpperCase()}`,
          entity_type: "users",
          entity_id: userId,
          details: { status }
        });
      }
      if (role && ["admin", "super_admin", "customer", "operator"].includes(role) && tgId) {
        if (role === "customer") {
          await supabase.from("user_roles").delete().eq("telegram_user_id", tgId);
        } else {
          await supabase.from("user_roles").upsert({
            telegram_user_id: tgId,
            role
          }, { onConflict: "telegram_user_id" });
        }
        await supabase.from("admin_audit_logs").insert({
          admin_telegram_id: session.telegramUserId,
          action: `USER_ROLE_${role.toUpperCase()}`,
          entity_type: "users",
          entity_id: userId || String(tgId),
          details: { role, telegramUserId: tgId }
        });
      }
      return res.status(200).json({ success: true, message: "Foydalanuvchi ma'lumotlari yangilandi" });
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
  const rateLimit = checkRateLimit(`auth:${ip}`, 30, 60);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: "Juda ko'p so'rov yuborildi. Birozdan so'ng qayta urinib ko'ring." });
  }
  const { initData, adminKey } = req.body || {};
  if (adminKey) {
    return res.status(401).json({ error: "Admin kaliti bilan kirish o'chirilgan. Telegram orqali kiring." });
  }
  if (!initData || typeof initData !== "string") {
    return res.status(400).json({ error: "Telegram initData talab qilinadi" });
  }
  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: validation.error || "Telegram autentifikatsiyasi tasdiqlanmadi" });
  }
  const tgUser = validation.user;
  const isHardcodedAdmin = isTelegramAdmin(tgUser.id);
  const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") || tgUser.username || "Mijoz";
  const supabase = getSupabase();
  if (!supabase) {
    if (process.env.ALLOW_DEV_AUTH === "1" && process.env.NODE_ENV !== "production") {
      const role = isHardcodedAdmin ? "super_admin" : "customer";
      const code = `YK-${String(tgUser.id).slice(-4)}`;
      const token = createSessionToken({ userId: `usr_dev_${tgUser.id}`, telegramUserId: tgUser.id, customerCode: code, role }, "12h");
      return res.status(200).json({
        token,
        user: { id: `usr_dev_${tgUser.id}`, telegramUserId: tgUser.id, customerCode: code, name: displayName, role },
        devMode: true
      });
    }
    return res.status(503).json({ error: "Server sozlanmagan (ma'lumotlar bazasi yo'q)" });
  }
  try {
    const cols = "id, telegram_user_id, customer_code, name, phone, status";
    let { data: dbUser, error: selErr } = await supabase.from("users").select(cols).eq("telegram_user_id", tgUser.id).maybeSingle();
    if (selErr) throw selErr;
    if (!dbUser) {
      const { data: created, error: insErr } = await supabase.from("users").upsert(
        {
          telegram_user_id: tgUser.id,
          name: displayName,
          phone: "pending",
          onboarding_completed: true,
          onboarding_step: "completed"
        },
        { onConflict: "telegram_user_id" }
      ).select(cols).maybeSingle();
      if (insErr) throw insErr;
      dbUser = created;
    }
    if (!dbUser) throw new Error("User could not be loaded");
    if (dbUser.status === "blocked" && !isHardcodedAdmin) {
      return res.status(403).json({ error: "Sizning hisobingiz bloklangan. Administrator bilan bog'laning." });
    }
    let role = isHardcodedAdmin ? "super_admin" : "customer";
    if (!isHardcodedAdmin) {
      const { data: roleRow, error: roleErr } = await supabase.from("user_roles").select("role").eq("telegram_user_id", tgUser.id).maybeSingle();
      if (roleErr) throw roleErr;
      if (roleRow?.role === "admin" || roleRow?.role === "super_admin") role = roleRow.role;
    }
    const token = createSessionToken(
      { userId: dbUser.id, telegramUserId: tgUser.id, customerCode: dbUser.customer_code, role },
      role === "customer" ? "7d" : "12h"
    );
    return res.status(200).json({
      token,
      user: {
        id: dbUser.id,
        telegramUserId: tgUser.id,
        customerCode: dbUser.customer_code,
        name: dbUser.name || displayName,
        phone: dbUser.phone && dbUser.phone !== "pending" ? dbUser.phone : "",
        status: dbUser.status || "active",
        role
      }
    });
  } catch (err) {
    console.error("Auth session error:", err);
    return res.status(503).json({ error: "Kirishda xatolik. Birozdan so'ng qayta urinib ko'ring." });
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
    return res.status(503).json({ error: "Server sozlanmagan (ma'lumotlar bazasi yo'q)" });
  }
  try {
    let query = supabase.from("users").select(`
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
      `);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.userId);
    if (isUuid) {
      query = query.eq("id", session.userId);
    } else if (session.telegramUserId) {
      query = query.eq("telegram_user_id", session.telegramUserId);
    } else {
      query = query.eq("customer_code", session.customerCode);
    }
    const { data: user } = await query.maybeSingle();
    if (!user) {
      return res.status(401).json({ error: "Foydalanuvchi topilmadi, qayta kiring" });
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
    console.error("user/me error:", err);
    return res.status(500).json({ error: "Serverda xatolik yuz berdi" });
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
