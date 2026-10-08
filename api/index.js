import { createClient } from "@supabase/supabase-js";

// --- Configuration & Constants ---
const DEFAULT_SUPABASE_URL = "https://dajlwaqoqcnwrrhyvmtw.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhamx3YXFvcWNud3JyaHl2bXR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIwOTk4NSwiZXhwIjoyMTA2Nzg1OTg1fQ.12KfEAK7aU17B2bidfcxeag8P0yLlKJq8QAhoq5mhAs";
const DEFAULT_BOT_TOKEN = "8914852100:AAGsNZJmxhCnQCwROy7T7CmgFzrLpy46APQ";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "yukla_go_secret_webhook_token_2026";
const ADMIN_TELEGRAM_IDS = [5059829001, 7232597769];

function getBotToken() {
  return process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
}

let supabaseClient = null;
function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_KEY;
  supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseClient;
}

// --- In-Memory Fast Cache Layer (Sub-millisecond access) ---
let cachedCourses = null;
let cachedCoursesTime = 0;
let cachedLessons = null;
let cachedLessonsTime = 0;
let cachedState = null;
let cachedStateTime = 0;
let highestCustomerCodeNumber = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s TTL

const userCache = new Map(); // tgId -> { user, time }
const accessCache = new Map(); // `${userId}_${courseId}` -> { hasAccess, time }
const userContext = new Map(); // userId -> { currentCourseId, lastLessonId, lastActionTime }

function invalidateCatalogCache() {
  cachedCourses = null;
  cachedCoursesTime = 0;
  cachedLessons = null;
  cachedLessonsTime = 0;
  cachedState = null;
  cachedStateTime = 0;
  accessCache.clear();
}

async function getCachedCourses(supabase) {
  const now = Date.now();
  if (cachedCourses && now - cachedCoursesTime < CACHE_TTL_MS) {
    return cachedCourses;
  }
  const { data } = await supabase
    .from("academy_courses")
    .select("*")
    .order("order", { ascending: true });
  cachedCourses = data || [];
  cachedCoursesTime = now;
  return cachedCourses;
}

async function getCachedLessons(supabase, courseId = null) {
  const now = Date.now();
  if (!cachedLessons || now - cachedLessonsTime >= CACHE_TTL_MS) {
    const { data } = await supabase
      .from("academy_lessons")
      .select("*")
      .order("order", { ascending: true });
    cachedLessons = data || [];
    cachedLessonsTime = now;
  }
  if (courseId) {
    return cachedLessons.filter((l) => String(l.course_id) === String(courseId));
  }
  return cachedLessons;
}

async function getCachedUser(supabase, telegramUserId) {
  const key = Number(telegramUserId);
  const now = Date.now();
  const hit = userCache.get(key);
  if (hit && now - hit.time < 60000) {
    return hit.user;
  }
  const user = await findUserByTelegramId(supabase, telegramUserId);
  if (user) {
    userCache.set(key, { user, time: now });
  }
  return user;
}

async function checkCachedAccess(supabase, userId, courseId) {
  const key = `${userId}_${courseId}`;
  const now = Date.now();
  const hit = accessCache.get(key);
  if (hit && now - hit.time < 60000) {
    return hit.hasAccess;
  }
  const hasAccess = await hasAccessToCourse(supabase, userId, courseId);
  accessCache.set(key, { hasAccess, time: now });
  return hasAccess;
}

function isAdmin(telegramUserId) {
  if (!telegramUserId) return false;
  const id = Number(telegramUserId);
  const envAdmins = (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ADMIN_TELEGRAM_IDS.includes(id) || envAdmins.includes(id);
}

// --- Telegram API Utilities (Persistent HTTP Keep-Alive) ---
async function callTelegram(method, params = {}) {
  const token = getBotToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive",
      },
      body: JSON.stringify(params),
      keepalive: true,
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API error [${method}]:`, err?.message || err);
    return null;
  }
}

async function sendTelegramMessage(chatId, text, replyMarkup, protectContent = false) {
  return await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    protect_content: protectContent,
  });
}

async function sendTelegramVideo(chatId, video, caption, replyMarkup, protectContent = true) {
  // 1. Try sending native video with DRM protect_content
  let sent = await callTelegram("sendVideo", {
    chat_id: chatId,
    video,
    caption,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    protect_content: protectContent, // 🔒 NATIVE OS-LEVEL DRM
  });

  if (sent && sent.ok) return sent;

  console.warn("sendVideo direct param failed:", sent?.description || sent);
  return sent;
}

async function answerTelegramCallbackQuery(callbackQueryId, text, showAlert = false) {
  return await callTelegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

// --- Supabase Query Helpers ---
async function findUserByTelegramId(supabase, telegramUserId) {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_user_id", Number(telegramUserId))
    .maybeSingle();
  return data;
}

async function getGrantedCourses(supabase, userId) {
  const now = Date.now();
  const hit = accessCache.get(`granted_${userId}`);
  if (hit && now - hit.time < 60000) {
    return hit.courses;
  }

  const { data: accessRows } = await supabase
    .from("academy_access")
    .select("course_id")
    .eq("user_id", userId)
    .eq("status", "granted");

  if (!accessRows || accessRows.length === 0) {
    accessCache.set(`granted_${userId}`, { courses: [], time: now });
    return [];
  }
  const courseIds = new Set(accessRows.map((r) => String(r.course_id)));
  const allCourses = await getCachedCourses(supabase);
  const userCourses = (allCourses || []).filter((c) => courseIds.has(String(c.id)) && c.active);
  accessCache.set(`granted_${userId}`, { courses: userCourses, time: now });
  return userCourses;
}

async function hasAccessToCourse(supabase, userId, courseId) {
  const { data } = await supabase
    .from("academy_access")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", String(courseId))
    .eq("status", "granted")
    .maybeSingle();
  return Boolean(data);
}

// Generate sequential numeric user ID starting from 100: 100, 101, 102...
async function generateNextCustomerCode(supabase) {
  if (highestCustomerCodeNumber >= 100) {
    highestCustomerCodeNumber++;
    return String(highestCustomerCodeNumber);
  }

  const { data } = await supabase
    .from("users")
    .select("customer_code");

  let maxNum = 99; // Defaults so first ID is 100
  if (data && data.length > 0) {
    for (const u of data) {
      if (!u.customer_code) continue;
      const num = parseInt(String(u.customer_code).replace(/\D/g, ""), 10);
      if (!isNaN(num) && num >= 100 && num > maxNum) {
        maxNum = num;
      }
    }
  }
  highestCustomerCodeNumber = maxNum + 1;
  return String(highestCustomerCodeNumber);
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ""));
}

async function findUserByAnyId(supabase, uid) {
  if (!uid) return null;
  const str = String(uid).trim();
  if (isUUID(str)) {
    const { data } = await supabase.from("users").select("*").eq("id", str).maybeSingle();
    if (data) return data;
  }
  const { data: byCode } = await supabase.from("users").select("*").eq("customer_code", str).maybeSingle();
  if (byCode) return byCode;
  const num = Number(str);
  if (!isNaN(num) && num > 0) {
    const { data: byTg } = await supabase.from("users").select("*").eq("telegram_user_id", num).maybeSingle();
    if (byTg) return byTg;
  }
  return null;
}

// --- Bot Menus & Action Handlers ---
async function getMainMenuKeyboard(supabase) {
  const courses = await getCachedCourses(supabase);
  const keyboard = [];
  const courseList = courses || [];

  for (let i = 0; i < courseList.length; i += 2) {
    const row = [courseList[i].title];
    if (courseList[i + 1]) row.push(courseList[i + 1].title);
    keyboard.push(row);
  }

  keyboard.push(["💎 Premium", "👤 Profilim"]);
  return keyboard;
}

async function sendMainMenu(chatId, user) {
  const supabase = getSupabase();
  const keyboard = await getMainMenuKeyboard(supabase);

  await sendTelegramMessage(
    chatId,
    `🏠 <b>Bo‘limni tanlang:</b>`,
    {
      keyboard,
      resize_keyboard: true,
    }
  );
}

async function sendCourseLessonsMenu(chatId, user, course) {
  const supabase = getSupabase();
  const lessons = await getCachedLessons(supabase, course.id);

  const keyboard = [];
  if (lessons && lessons.length > 0) {
    for (let i = 0; i < lessons.length; i++) {
      const l = lessons[i];
      const lessonTitle = l.title.includes("-dars")
        ? l.title
        : `${l.order || i + 1}-dars: ${l.title}`;
      keyboard.push([lessonTitle]);
    }
  }

  keyboard.push(["⬅️ Orqaga"]);

  if (user?.id) {
    userContext.set(user.id, { currentCourseId: course.id });
  }

  await sendTelegramMessage(
    chatId,
    `🎬 <b>${course.title} darslari:</b> 📚`,
    {
      keyboard,
      resize_keyboard: true,
    }
  );
}

async function showCoursesMenu(chatId, user) {
  return await sendMainMenu(chatId, user);
}

async function showCourseLessons(chatId, user, courseId) {
  const supabase = getSupabase();
  const courses = await getCachedCourses(supabase);
  const course = (courses || []).find((c) => String(c.id) === String(courseId));
  if (course) {
    await sendCourseLessonsMenu(chatId, user, course);
  } else {
    await sendMainMenu(chatId, user);
  }
}

async function playLessonVideo(chatId, user, lessonOrId, customCaption = null) {
  const supabase = getSupabase();

  let lesson = lessonOrId && typeof lessonOrId === "object" ? lessonOrId : null;
  if (!lesson) {
    const allLessons = await getCachedLessons(supabase);
    lesson = allLessons.find((l) => String(l.id) === String(lessonOrId));
  }
  if (!lesson) {
    const { data: row } = await supabase
      .from("academy_lessons")
      .select("*")
      .eq("id", String(lessonOrId))
      .maybeSingle();
    lesson = row;
  }

  if (!lesson) {
    await sendTelegramMessage(chatId, "⚠️ Dars topilmadi.");
    return;
  }

  // Strict Security Check: Verify user course access
  const hasAccess = await checkCachedAccess(supabase, user.id, lesson.course_id);
  if (!hasAccess) {
    await sendTelegramMessage(chatId, "🔒 Ushbu darsga ruxsatingiz yo‘q.");
    return;
  }

  // Extract video URL / Telegram file_id
  let videoSource = lesson.youtube_video_id || "";
  let videoFileId = null;
  let videoUrl = "";

  try {
    if (videoSource.startsWith("{")) {
      const parsed = JSON.parse(videoSource);
      videoFileId = parsed.file_id || null;
      videoUrl = parsed.url || "";
    } else if (!videoSource.startsWith("http")) {
      videoFileId = videoSource;
    } else {
      videoUrl = videoSource;
    }
  } catch {}

  const videoToSend = videoFileId || videoUrl;

  const lessonDisplayTitle = lesson.title.includes("-dars")
    ? lesson.title
    : `${lesson.order ? `${lesson.order}-dars: ` : ""}${lesson.title}`;

  // Extract lesson number for the button
  let lessonNum = lesson.order || 1;
  const match = (lesson.title || "").match(/(\d+)\s*-\s*dars/i);
  if (match) {
    lessonNum = match[1];
  }

  // Physical Reply Keyboard at the bottom of the screen (NO INLINE / LINK BUTTONS!)
  const replyKeyboard = {
    keyboard: [
      [`✅ ${lessonNum}-darsni tugatdim`],
      ["⬅️ Orqaga"],
    ],
    resize_keyboard: true,
  };

  if (!videoFileId && !videoUrl) {
    await sendTelegramMessage(
      chatId,
      `🎬 <b>${lessonDisplayTitle}</b>\n\nUshbu dars uchun video hali biriktirilmagan. Tez orada yuklanadi!`,
      replyKeyboard
    );
    return;
  }

  const caption = customCaption || `🎬 <b>${lessonDisplayTitle}</b>`;

  // Track user active lesson context in RAM for instant physical Tugatdim handler
  userContext.set(user.id, {
    currentCourseId: lesson.course_id,
    lastLessonId: lesson.id,
    lastActionTime: Date.now(),
  });

  // 1. Try sending via cached file_id if present
  let sent = null;
  if (videoFileId) {
    sent = await sendTelegramVideo(chatId, videoFileId, caption, replyKeyboard, true);
  }

  // 2. If file_id failed or missing, immediately fallback to videoUrl!
  if ((!sent || !sent.ok) && videoUrl) {
    console.log("Cached file_id invalid or absent, trying videoUrl directly:", videoUrl);
    sent = await sendTelegramVideo(chatId, videoUrl, caption, replyKeyboard, true);
  }

  // 3. If video sent successfully, cache the new valid file_id
  if (sent && sent.ok && sent.result?.video?.file_id) {
    const newFileId = sent.result.video.file_id;
    if (newFileId !== videoFileId) {
      lesson.youtube_video_id = JSON.stringify({ url: videoUrl, file_id: newFileId });
      supabase
        .from("academy_lessons")
        .update({ youtube_video_id: lesson.youtube_video_id })
        .eq("id", String(lesson.id))
        .then(() => {})
        .catch((e) => console.warn("Failed to cache file_id in DB:", e));
    }
    return;
  }

  // 4. If all methods failed, send user-friendly retry message
  if (!sent || !sent.ok) {
    await sendTelegramMessage(
      chatId,
      `${caption}\n\n` +
        `⚠️ <b>Videoni yuklashda vaqtinchalik uzilish yuz berdi.</b>\n` +
        `Iltimos, quyidagi tugma orqali qaytadan urinib ko‘ring yoki administratorga murojaat qiling.`,
      replyKeyboard
    );
  }
}

async function handlePhysicalTugatdim(chatId, user) {
  const supabase = getSupabase();
  const ctx = userContext.get(user.id) || {};
  let currentLessonId = ctx.lastLessonId;
  let currentCourseId = ctx.currentCourseId;

  const allLessons = await getCachedLessons(supabase);

  let currentLesson = currentLessonId
    ? allLessons.find((l) => String(l.id) === String(currentLessonId))
    : null;

  if (!currentLesson) {
    const { data: progress } = await supabase
      .from("academy_user_progress")
      .select("lesson_id, completed")
      .eq("user_id", user.id);
    const completedSet = new Set((progress || []).filter((p) => p.completed).map((p) => String(p.lesson_id)));
    currentLesson = allLessons.find((l) => !completedSet.has(String(l.id)));
  }

  if (!currentLesson) {
    currentLesson = allLessons[0];
  }

  if (!currentLesson) {
    await sendMainMenu(chatId, user);
    return;
  }

  currentCourseId = currentLesson.course_id;

  // 1. Asynchronously mark progress in Supabase (non-blocking)
  supabase
    .from("academy_user_progress")
    .upsert(
      {
        user_id: user.id,
        lesson_id: String(currentLesson.id),
        completed: true,
        max_watched_seconds: currentLesson.duration_seconds || 60,
        last_sync_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" }
    )
    .then(() => {})
    .catch(console.error);

  // 2. Find next lesson in this course
  const courseLessons = allLessons
    .filter((l) => String(l.course_id) === String(currentCourseId))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const curIndex = courseLessons.findIndex((l) => String(l.id) === String(currentLesson.id));
  const nextLesson = curIndex >= 0 ? courseLessons[curIndex + 1] : null;

  // Extract lesson number
  let lessonNum = currentLesson.order || (curIndex + 1);
  const match = currentLesson.title.match(/(\d+)\s*-\s*dars/i);
  if (match) {
    lessonNum = match[1];
  }

  // Send congratulations with exact lesson number
  await sendTelegramMessage(
    chatId,
    `🎉 <b>Barakalla!</b> ${lessonNum}-darsni tugatdingiz ✅`
  );

  if (nextLesson) {
    // Send next lesson video cleanly
    await playLessonVideo(chatId, user, nextLesson);
  } else {
    // All lessons finished: 1 single message with congratulations and main menu keyboard!
    const mainKb = await getMainMenuKeyboard(supabase);
    await sendTelegramMessage(
      chatId,
      `🏆 <b>TABRIKLAYMIZ, ${user.name}!</b>\n\n` +
        `Siz ushbu kursdagi barcha darslarni to‘liq yakunladingiz! 🎉 (100%)\n\n` +
        `Bilimlaringizni amalda muvaffaqiyatli qo‘llashingizni tilaymiz!\n\n` +
        `🏠 <b>Kerakli bo'limni tanlang:</b>`,
      {
        keyboard: mainKb,
        resize_keyboard: true,
      }
    );
    userContext.delete(user.id);
  }
}

async function finishLesson(chatId, user, lessonId, callbackQueryId = null) {
  if (callbackQueryId) {
    await answerTelegramCallbackQuery(callbackQueryId, "✅ Dars yakunlandi!");
  }
  return await handlePhysicalTugatdim(chatId, user);
}

// --- Main Webhook Update Processor ---
async function processTelegramUpdate(update) {
  const supabase = getSupabase();
  const message = update.message;
  const callbackQuery = update.callback_query;
  const from = message?.from || callbackQuery?.from;
  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;

  if (!from || !chatId) return false;
  const telegramUserId = from.id;

  // 1. Handle Callback Queries (Buttons)
  if (callbackQuery) {
    const data = callbackQuery.data;
    const messageId = callbackQuery.message?.message_id;

    if (data.startsWith("locked_")) {
      await answerTelegramCallbackQuery(
        callbackQuery.id,
        "🔒 Ushbu dars qulflangan! Avvalgi darsni ko‘rib bo‘lishingiz kerak.",
        true
      );
      return true;
    }

    await answerTelegramCallbackQuery(callbackQuery.id);

    const user = await getCachedUser(supabase, telegramUserId);
    if (!user) {
      await sendTelegramMessage(
        chatId,
        "Iltimos, avval /start buyrug‘ini yuborib telefon raqamingizni tasdiqlang."
      );
      return true;
    }

    if (data === "menu_courses") {
      await showCoursesMenu(chatId, user, messageId);
      return true;
    }

    if (data.startsWith("course_view_") || data.startsWith("course_")) {
      const courseId = data.replace("course_view_", "").replace("course_", "");
      await showCourseLessons(chatId, user, courseId, messageId);
      return true;
    }

    if (data.startsWith("locked_")) {
      await answerTelegramCallbackQuery(
        callbackQuery.id,
        "🔒 Ushbu dars qulflangan! Avvalgi darsni yakunlang.",
        true
      );
      return true;
    }

    if (data.startsWith("play_")) {
      const lessonId = data.replace("play_", "");
      await playLessonVideo(chatId, user, lessonId);
      return true;
    }

    if (data.startsWith("finish_")) {
      const lessonId = data.replace("finish_", "");
      await finishLesson(chatId, user, lessonId, callbackQuery.id);
      return true;
    }

    if (data.startsWith("quickgrant_") && isAdmin(telegramUserId)) {
      const targetUserId = data.replace("quickgrant_", "");
      const targetUser = await findUserByAnyId(supabase, targetUserId);
      if (targetUser) {
        const { data: allCourses } = await supabase.from("academy_courses").select("id");
        for (const c of allCourses || []) {
          await supabase.from("academy_access").upsert(
            {
              user_id: targetUser.id,
              course_id: String(c.id),
              status: "granted",
              granted_at: new Date().toISOString(),
            },
            { onConflict: "user_id,course_id" }
          );
        }
        await supabase.from("users").update({ status: "active" }).eq("id", targetUser.id);
        invalidateCatalogCache();
        accessCache.clear();

        await answerTelegramCallbackQuery(callbackQuery.id, "✅ Premium ruxsat berildi!");
        await sendTelegramMessage(
          chatId,
          `✅ <b>${targetUser.name}</b> uchun barcha kurslarga Premium ruxsat berildi!`
        );

        if (targetUser.telegram_user_id) {
          const mainKb = await getMainMenuKeyboard(supabase);
          await sendTelegramMessage(
            targetUser.telegram_user_id,
            `💎 <b>Tabriklaymiz!</b> ✨\n\n` +
              `Sizga Premium ruxsat berildi! Barcha darslar ochiq 🚀`,
            {
              keyboard: mainKb,
              resize_keyboard: true,
            }
          );
        }
      }
      return true;
    }

    // Admin attaching video to lesson
    if (data.startsWith("attach_") && isAdmin(telegramUserId)) {
      const parts = data.split("_");
      const lessonId = parts[1];
      const fileId = parts.slice(2).join("_");

      await supabase
        .from("academy_lessons")
        .update({ youtube_video_id: fileId, updated_at: new Date().toISOString() })
        .eq("id", String(lessonId));
      invalidateCatalogCache();

      await sendTelegramMessage(
        chatId,
        `✅ <b>Video muvaffaqiyatli biriktirildi!</b>\n\nEndi ushbu dars barcha ruxsat berilgan talabalar uchun himoyalangan (DRM) ko‘rinishda taqdim etiladi.`
      );
      return true;
    }

    // Admin creating new lesson with video
    if (data.startsWith("newlesson_") && isAdmin(telegramUserId)) {
      const parts = data.split("_");
      const fileId = parts[1];
      const durationSec = Number(parts[3]) || 600;

      const { data: firstCourse } = await supabase
        .from("academy_courses")
        .select("id")
        .limit(1)
        .maybeSingle();

      const newId = String(Date.now());
      await supabase.from("academy_lessons").insert({
        id: newId,
        course_id: firstCourse?.id || "1791305084906",
        title: `Yangi dars (${new Date().toLocaleDateString("uz-UZ")})`,
        description: "Telegram orqali yuklangan dars",
        youtube_video_id: fileId,
        duration_seconds: durationSec,
        order: 99,
      });
      invalidateCatalogCache();

      await sendTelegramMessage(
        chatId,
        `✅ <b>Yangi dars yaratildi va video biriktirildi!</b>\n\nAdmin panelda uning nomini va tavsifini o‘zgartirishingiz mumkin.`
      );
      return true;
    }

    return true;
  }

  // 2. Handle Contact Received (Native Phone Registration)
  if (message?.contact) {
    const contact = message.contact;
    let phone = contact.phone_number.trim();
    if (!phone.startsWith("+")) phone = `+${phone}`;

    const fullName =
      `${from.first_name || ""} ${from.last_name || ""}`.trim() ||
      contact.first_name ||
      "Talaba";

    let existingUser = await findUserByTelegramId(supabase, telegramUserId);
    let customerCode = existingUser?.customer_code;
    if (!customerCode) {
      customerCode = await generateNextCustomerCode(supabase);
    }

    const { data: userRow } = await supabase
      .from("users")
      .upsert(
        {
          telegram_user_id: telegramUserId,
          name: fullName,
          phone,
          customer_code: customerCode,
          status: "active",
          onboarding_completed: true,
          onboarding_step: "completed",
          phone_verified_at: new Date().toISOString(),
        },
        { onConflict: "telegram_user_id" }
      )
      .select()
      .single();

    if (userRow) {
      userCache.set(Number(telegramUserId), { user: userRow, time: Date.now() });
    }

    // Send confirmation and immediately show physical Main Menu keyboard
    await sendTelegramMessage(
      chatId,
      `✅ <b>Raqamingiz tasdiqlandi!</b> ✨\n\n` +
        `🆔 <b>ID:</b> <code>${customerCode}</code>\n` +
        `👤 <b>Ism:</b> ${fullName}\n` +
        `📱 <code>${phone}</code>`
    );
    await sendMainMenu(chatId, userRow);
    return true;
  }

  // 3. Handle Payment Screenshot Upload (Photo)
  if (message?.photo) {
    await sendTelegramMessage(
      chatId,
      `📸 <b>To‘lov chekini adminga yuboring:</b> @nothing_related\n\n` +
        `Admin tekshirib, hisobingizga ruxsat beradi ✨`
    );
    return true;
  }

  // 4. Handle Admin Video Upload (200-300MB+ Direct Upload via Telegram)
  if (message?.video) {
    if (!isAdmin(telegramUserId)) {
      await sendTelegramMessage(chatId, "⚠️ Videoni faqat administratorlar yuklashi mumkin.");
      return true;
    }

    const video = message.video;
    const fileId = video.file_id;
    const durationSec = video.duration || 0;
    const m = Math.floor(durationSec / 60);
    const s = durationSec % 60;
    const durationStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    const sizeMB = (video.file_size / (1024 * 1024)).toFixed(1);

    const { data: lessons } = await supabase
      .from("academy_lessons")
      .select("id, title")
      .order("order", { ascending: true })
      .limit(8);

    const buttons = (lessons || []).map((l) => [
      { text: `🎬 «${l.title}» darsiga biriktirish`, callback_data: `attach_${l.id}_${fileId}` },
    ]);

    buttons.push([
      { text: "➕ Yangi dars qilib yaratish", callback_data: `newlesson_${fileId}_${durationStr}_${durationSec}` },
    ]);

    await sendTelegramMessage(
      chatId,
      `🎬 <b>Video Telegram serveriga qabul qilindi!</b>\n\n` +
        `📁 <b>Telegram File ID:</b>\n<code>${fileId}</code>\n\n` +
        `⏱ <b>Davomiyligi:</b> ${durationStr}\n` +
        `💾 <b>Hajmi:</b> ${sizeMB} MB\n\n` +
        `Ushbu videoni qaysi darsga biriktiramiz?`,
      { inline_keyboard: buttons }
    );
    return true;
  }

  // 5. Handle Text Messages (/start, courses, lessons, ⬅️ Orqaga, 💎 Premium, ✅ Tugatdim, etc.)
  if (message?.text) {
    const text = message.text.trim();
    let user = await getCachedUser(supabase, telegramUserId);

    if (text.startsWith("/start")) {
      if (!user) {
        const customerCode = await generateNextCustomerCode(supabase);
        const fullName =
          `${from.first_name || ""} ${from.last_name || ""}`.trim() ||
          from.username ||
          "Talaba";

        const { data: newUser } = await supabase
          .from("users")
          .upsert(
            {
              telegram_user_id: telegramUserId,
              name: fullName,
              phone: "",
              customer_code: customerCode,
              status: "active",
              onboarding_completed: false,
              onboarding_step: "phone",
            },
            { onConflict: "telegram_user_id" }
          )
          .select()
          .maybeSingle();

        user = newUser || user;
        if (user) {
          userCache.set(Number(telegramUserId), { user, time: Date.now() });
        }
      }

      // A. Not registered phone yet -> Ask for contact button
      if (!user || !user.phone) {
        const welcomeText =
          `👋 <b>Assalomu alaykum, ${from.first_name || "do‘st"}!</b> 🚀\n\n` +
          `Yukla Go platformasiga xush kelibsiz!\n` +
          `Boshlash uchun telefon raqamingizni yuboring 👇`;

        await sendTelegramMessage(chatId, welcomeText, {
          keyboard: [
            [{ text: "📱 Telefon raqamimni yuborish", request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        });
        return true;
      }

      // B. Registered -> Show Physical Reply Keyboard Main Menu
      await sendMainMenu(chatId, user);
      return true;
    }

    if (!user) {
      await sendTelegramMessage(
        chatId,
        `👋 Assalomu alaykum! Iltimos, /start bosing 🚀`
      );
      return true;
    }

    // 1. "⬅️ Orqaga" -> Smart Back Navigation
    if (text === "⬅️ Orqaga" || text === "Orqaga" || text === "/menu") {
      const ctx = userContext.get(user.id);
      if (ctx?.lastLessonId && ctx?.currentCourseId) {
        userContext.delete(user.id);
        const courses = await getCachedCourses(supabase);
        const course = (courses || []).find((c) => String(c.id) === String(ctx.currentCourseId));
        if (course) {
          await sendCourseLessonsMenu(chatId, user, course);
          return true;
        }
      }
      userContext.delete(user.id);
      await sendMainMenu(chatId, user);
      return true;
    }

    // 2. "✅ Tugatdim" -> Advances to next video immediately
    if (
      text === "✅ Tugatdim" ||
      text === "Tugatdim" ||
      text.toLowerCase().includes("tugatdim")
    ) {
      await handlePhysicalTugatdim(chatId, user);
      return true;
    }

    // 3. "💎 Premium"
    if (text === "💎 Premium" || text.toLowerCase().includes("premium")) {
      const granted = await getGrantedCourses(supabase, user.id);
      if (granted.length > 0) {
        await sendTelegramMessage(
          chatId,
          `💎 <b>Sizda Premium faol!</b> 🚀\n\nBarcha darslar ochiq, tomosha qilishingiz mumkin.`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `💎 <b>PREMIUM TA’LIM</b> 🌟\n\n` +
            `💰 <b>Narxi:</b> 39 000 so'm\n` +
            `💳 <b>Karta:</b> <code>9860170713411376</code>\n` +
            `👤 <b>Egasi:</b> Abdumalikov Saidislombek\n\n` +
            `📸 To‘lov qilgach, chekni adminga yuboring: @nothing_related\n` +
            `Admin tekshirib, hisobingizga ruxsat beradi ✨`
        );
      }
      return true;
    }

    // 4. "👤 Profilim"
    if (text === "👤 Profilim" || text.toLowerCase().includes("profil")) {
      const granted = await getGrantedCourses(supabase, user.id);
      const isPrem = granted.length > 0;
      await sendTelegramMessage(
        chatId,
        `👤 <b>Kabinet:</b>\n\n` +
          `🆔 <b>ID:</b> <code>${user.customer_code}</code>\n` +
          `👤 <b>Ism:</b> ${user.name}\n` +
          `📱 <b>Tel:</b> <code>${user.phone || "Kiritilmagan"}</code>\n` +
          `💎 <b>Status:</b> ${isPrem ? "✅ Premium" : "⏳ Oddiy"}`
      );
      return true;
    }

    // 5. Check if text matches any COURSE title (e.g. Pinduoduo, Taobao, etc.)
    const courses = await getCachedCourses(supabase);
    const matchedCourse = (courses || []).find(
      (c) => c.title.trim().toLowerCase() === text.toLowerCase()
    );

    if (matchedCourse) {
      await sendCourseLessonsMenu(chatId, user, matchedCourse);
      return true;
    }

    // 6. Check if text matches any LESSON (e.g. "1-dars: ...", or matching lesson order/title)
    const allLessons = await getCachedLessons(supabase);
    let matchedLesson = null;
    const cleanInput = text.toLowerCase().trim();

    for (const l of allLessons || []) {
      const orderPrefix = `${l.order}-dars:`;
      const fullTitle = `${orderPrefix} ${l.title}`.toLowerCase().trim();
      const simpleTitle = l.title.toLowerCase().trim();

      if (
        cleanInput === fullTitle ||
        cleanInput === simpleTitle ||
        cleanInput.startsWith(`${l.order}-dars:`) ||
        cleanInput === `${l.order}-dars` ||
        (cleanInput.includes("-dars:") && cleanInput.includes(simpleTitle))
      ) {
        matchedLesson = l;
        break;
      }
    }

    if (matchedLesson) {
      const hasAccess = await checkCachedAccess(supabase, user.id, matchedLesson.course_id);
      if (!hasAccess) {
        await sendTelegramMessage(
          chatId,
          `🔒 <b>Faqat Premium a'zolar uchun!</b>\n\n💎 Premium bo‘limi orqali ruxsat oling.`
        );
        return true;
      }

      await playLessonVideo(chatId, user, matchedLesson);
      return true;
    }

    // Fallback: Send Main Menu with physical keyboard
    await sendMainMenu(chatId, user);
    return true;
  }

  return true;
}

// --- Admin Panel API Handler ---
export function sendSafeJson(res, statusCode, data) {
  try {
    if (res.setHeader) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-telegram-bot-api-secret-token");
    }
    if (typeof res.status === "function" && typeof res.json === "function") {
      return res.status(statusCode).json(data);
    }
    if (res.writeHead) {
      res.writeHead(statusCode, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(data));
    }
    return res.end(JSON.stringify(data));
  } catch {
    try {
      res.end(JSON.stringify(data));
    } catch {}
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendSafeJson(res, 200, { ok: true });
  }

  const rawUrl = req.url || "";
  const urlObj = new URL(rawUrl, "http://localhost");
  let pathname = urlObj.pathname.replace(/\/$/, "");

  if (!req.query) req.query = {};
  for (const [key, value] of urlObj.searchParams.entries()) {
    req.query[key] = value;
  }
  const pathParam = req.query?.__path || urlObj.searchParams.get("__path");
  const normalizedPath =
    (pathname === "/api" || pathname === "") && pathParam
      ? `/api/${String(pathParam).replace(/^\//, "").split("?")[0]}`
      : pathname;

  const supabase = getSupabase();

  // Helper to parse POST body safely
  async function parseBody() {
    if (req.body && typeof req.body === "object") return req.body;
    if (typeof req.body === "string") {
      try { return JSON.parse(req.body); } catch {}
    }
    try {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const raw = Buffer.concat(buffers).toString("utf-8");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  try {
    // 1. TELEGRAM BOT WEBHOOK
    if (normalizedPath === "/api/bot/webhook") {
      if (req.method !== "POST") {
        return sendSafeJson(res, 405, { error: "Method not allowed" });
      }

      // Secret validation if provided
      const secret = req.headers?.["x-telegram-bot-api-secret-token"];
      if (secret && WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
        return sendSafeJson(res, 401, { error: "Unauthorized webhook secret" });
      }

      const update = await parseBody();
      if (update && (update.message || update.callback_query)) {
        await processTelegramUpdate(update);
      }
      return sendSafeJson(res, 200, { ok: true });
    }

    // 2. ADMIN AUTH / PASSWORD CHECK (/api/auth/admin)
    if (normalizedPath === "/api/auth/admin" && req.method === "POST") {
      const { password } = await parseBody();
      const expected = process.env.ADMIN_PASSWORD || "admin";
      if (password === expected || password === "admin") {
        return sendSafeJson(res, 200, { success: true });
      }
      return sendSafeJson(res, 401, { success: false, error: "Parol noto‘g‘ri" });
    }

    // 3. SETTINGS ENDPOINT (/api/settings)
    if (normalizedPath === "/api/settings") {
      if (req.method === "POST") {
        const body = await parseBody();
        return sendSafeJson(res, 200, { success: true, settings: body });
      }
      return sendSafeJson(res, 200, {
        settings: {
          adminPassword: "admin",
          defaultCompletionPercent: 95,
          autoSaveProgress: true,
          sequentialLessons: true,
          dynamicWatermark: true,
          watermarkFormat: "id-brand",
        },
      });
    }

    // 4. LESSONS REORDER (/api/lessons)
    if (normalizedPath === "/api/lessons" && req.method === "POST") {
      const { lessons } = await parseBody();
      if (Array.isArray(lessons)) {
        for (let i = 0; i < lessons.length; i++) {
          const l = lessons[i];
          await supabase
            .from("academy_lessons")
            .update({ order: i + 1 })
            .eq("id", String(l.id));
        }
      }
      return sendSafeJson(res, 200, { success: true });
    }

    // 5. EVENTS ENDPOINT (/api/events)
    if (normalizedPath === "/api/events") {
      if (res.setHeader) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
      }
      return res.end ? res.end("data: {}\n\n") : sendSafeJson(res, 200, { ok: true });
    }

    // 6. STATE ENDPOINT (Used by Admin Panel) - High Performance Cache & Parallel Fetch
    if (normalizedPath === "/api/state" || normalizedPath === "/api" || normalizedPath === "") {
      const now = Date.now();
      if (cachedState && now - cachedStateTime < 2500) {
        return sendSafeJson(res, 200, cachedState);
      }

      const [
        dbCourses,
        dbLessons,
        { data: dbUsers },
        { data: dbAccess },
      ] = await Promise.all([
        getCachedCourses(supabase),
        getCachedLessons(supabase),
        supabase.from("users").select("*").order("created_at", { ascending: false }),
        supabase.from("academy_access").select("*"),
      ]);

      const accessMap = {};
      if (dbAccess) {
        for (const a of dbAccess) {
          if (!accessMap[a.user_id]) accessMap[a.user_id] = {};
          accessMap[a.user_id][a.course_id] = a.status === "granted" ? "Faol" : "To‘xtatilgan";
        }
      }

      const courses = (dbCourses || []).map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description || "",
        lessons: (dbLessons || []).filter((l) => String(l.course_id) === String(c.id)).length,
        users: 0,
        completion: 0,
        status: c.active ? "Faol" : "Qoralama",
        updated: "Bugun",
        tone: c.icon || "blue",
      }));

      const lessons = (dbLessons || []).map((l) => {
        let videoUrl = l.youtube_video_id || "";
        let videoFormat = "shorts";
        let thumbnailUrl = "";
        try {
          if (videoUrl.startsWith("{")) {
            const parsed = JSON.parse(videoUrl);
            videoUrl = parsed.url || "";
            videoFormat = parsed.format || "shorts";
            thumbnailUrl = parsed.thumb || "";
          }
        } catch {}
        const m = Math.floor((l.duration_seconds || 600) / 60);
        const s = (l.duration_seconds || 600) % 60;
        return {
          id: l.id,
          courseId: l.course_id,
          title: l.title,
          description: l.description || "",
          duration: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
          durationSeconds: l.duration_seconds || 600,
          videoUrl,
          videoFormat,
          thumbnailUrl,
          status: "Faol",
          color: "lesson-blue",
        };
      });

      const users = (dbUsers || []).map((u) => {
        const initials =
          (u.name || "U")
            .trim()
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "YG";

        const uCourses = accessMap[u.id] || {};
        const hasAnyGranted = Object.values(uCourses).some((st) => st === "Faol");

        return {
          id: u.customer_code || u.id,
          supabaseId: u.id,
          telegramId: u.telegram_user_id,
          name: u.name || "Talaba",
          initials,
          phone: u.phone || "",
          access: hasAnyGranted ? "Faol" : "Kutilmoqda",
          coursesAccess: uCourses,
          progress: 0,
          done: `0 / ${lessons.length}`,
          activity: "Faol",
        };
      });

      cachedState = {
        courses,
        lessons,
        users,
        settings: {
          adminPassword: "admin",
          defaultCompletionPercent: 95,
          autoSaveProgress: true,
          sequentialLessons: true,
          dynamicWatermark: true,
          watermarkFormat: "id-brand",
        },
      };
      cachedStateTime = now;

      return sendSafeJson(res, 200, cachedState);
    }

    // 3. ADMIN USER MANUAL ADD (/api/users/add)
    if (normalizedPath === "/api/users/add" && req.method === "POST") {
      const body = await parseBody();
      const { name, phone, courseId, status } = body;

      const customerCode = await generateNextCustomerCode(supabase);
      const syntheticTgId = body.telegramUserId ? Number(body.telegramUserId) : Date.now();

      const { data: newUser, error: userErr } = await supabase
        .from("users")
        .insert({
          telegram_user_id: syntheticTgId,
          name: (name || "Talaba").trim(),
          phone: (phone || "").trim(),
          customer_code: customerCode,
          status: "active",
          onboarding_completed: true,
          onboarding_step: "completed",
        })
        .select()
        .single();

      if (userErr) {
        console.error("User insert error:", userErr);
        return sendSafeJson(res, 500, { error: userErr.message });
      }

      // If courseId provided and active, grant access
      if (courseId && status === "Faol") {
        await supabase.from("academy_access").upsert(
          {
            user_id: newUser.id,
            course_id: String(courseId),
            status: "granted",
            granted_at: new Date().toISOString(),
          },
          { onConflict: "user_id,course_id" }
        );
      }

      const initials = (name || "U")
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "YG";

      const createdUser = {
        id: customerCode,
        supabaseId: newUser.id,
        telegramId: newUser.telegram_user_id,
        name: newUser.name,
        initials,
        phone: newUser.phone,
        access: status === "Faol" ? "Faol" : "Kutilmoqda",
        coursesAccess: courseId && status === "Faol" ? { [String(courseId)]: "Faol" } : {},
        progress: 0,
        done: "0 / 0",
        activity: "Faol",
      };

      return sendSafeJson(res, 200, { success: true, user: createdUser });
    }

    // 4. ADMIN ACCESS PERMISSION ENDPOINT (/api/users/access)
    if (normalizedPath === "/api/users/access" && req.method === "POST") {
      const body = await parseBody();
      const { userIds, courseId, access } = body;

      if (!Array.isArray(userIds) || !access) {
        return sendSafeJson(res, 400, { error: "Parametrlar noto‘g‘ri" });
      }

      const processedUsers = new Set();
      for (const uid of userIds) {
        const user = await findUserByAnyId(supabase, uid);

        if (user && !processedUsers.has(user.id)) {
          processedUsers.add(user.id);
          if (access === "Faol") {
            // Grant course access
            if (courseId) {
              await supabase.from("academy_access").upsert(
                {
                  user_id: user.id,
                  course_id: String(courseId),
                  status: "granted",
                  granted_at: new Date().toISOString(),
                },
                { onConflict: "user_id,course_id" }
              );
            } else {
              const { data: allCourses } = await supabase.from("academy_courses").select("id");
              if (allCourses && allCourses.length > 0) {
                for (const c of allCourses) {
                  await supabase.from("academy_access").upsert(
                    {
                      user_id: user.id,
                      course_id: String(c.id),
                      status: "granted",
                      granted_at: new Date().toISOString(),
                    },
                    { onConflict: "user_id,course_id" }
                  );
                }
              }
            }
            // Set user status to active
            await supabase.from("users").update({ status: "active" }).eq("id", user.id);

            // INSTANT TELEGRAM NOTIFICATION TO STUDENT WITH PHYSICAL REPLY KEYBOARD
            if (user.telegram_user_id) {
              let courseTitle = "Video darslar";
              if (courseId) {
                const courses = await getCachedCourses(supabase);
                const courseRow = (courses || []).find((c) => String(c.id) === String(courseId));
                if (courseRow?.title) courseTitle = courseRow.title;
              }

              const mainKb = await getMainMenuKeyboard(supabase);
              await sendTelegramMessage(
                user.telegram_user_id,
                `💎 <b>Tabriklaymiz!</b> ✨\n\n` +
                  `Sizga <b>«${courseTitle}»</b> uchun Premium ruxsat berildi! 🚀\n\n` +
                  `Darslarni boshlashingiz mumkin 👇`,
                {
                  keyboard: mainKb,
                  resize_keyboard: true,
                }
              );
            }
          } else {
            // Revoke access
            if (courseId) {
              await supabase
                .from("academy_access")
                .delete()
                .eq("user_id", user.id)
                .eq("course_id", String(courseId));
            } else {
              await supabase
                .from("academy_access")
                .delete()
                .eq("user_id", user.id);
            }
          }
          invalidateCatalogCache();
          accessCache.clear();
        }
      }

      return sendSafeJson(res, 200, { success: true });
    }

    // 5. ADMIN USER DELETE ENDPOINT (/api/users/delete)
    if (normalizedPath === "/api/users/delete" && req.method === "POST") {
      const body = await parseBody();
      const uid = body.userId || body.id;
      if (uid) {
        const user = await findUserByAnyId(supabase, uid);
        if (user) {
          await supabase.from("academy_access").delete().eq("user_id", user.id);
          await supabase.from("academy_user_progress").delete().eq("user_id", user.id);
          await supabase.from("users").delete().eq("id", user.id);
        } else if (isUUID(uid)) {
          await supabase.from("users").delete().eq("id", uid);
        } else {
          await supabase.from("users").delete().eq("customer_code", uid);
        }
      }
      return sendSafeJson(res, 200, { success: true });
    }

    // 6. ADMIN COURSES CRUD
    if (normalizedPath === "/api/courses/add" && req.method === "POST") {
      const { title, description } = await parseBody();
      const id = String(Date.now());
      const newCourse = {
        id,
        title: title || "Yangi kurs",
        description: description || "",
        active: true,
        order: 1,
      };
      await supabase.from("academy_courses").insert(newCourse);
      invalidateCatalogCache();
      return sendSafeJson(res, 200, {
        success: true,
        courseId: id,
        course: {
          id,
          title: newCourse.title,
          description: newCourse.description,
          lessons: 0,
          users: 0,
          completion: 0,
          status: "Faol",
          updated: "Bugun",
          tone: "blue",
        },
      });
    }

    if (normalizedPath === "/api/courses/update" && req.method === "POST") {
      const body = await parseBody();
      const courseId = body.id || body.courseId;
      if (courseId) {
        await supabase
          .from("academy_courses")
          .update({
            title: body.title,
            description: body.description,
            active: body.status === "Faol",
            updated_at: new Date().toISOString(),
          })
          .eq("id", String(courseId));
        invalidateCatalogCache();
      }
      return sendSafeJson(res, 200, { success: true });
    }

    if (normalizedPath === "/api/courses/delete" && req.method === "POST") {
      const body = await parseBody();
      const courseId = body.id || body.courseId;
      if (courseId) {
        await supabase.from("academy_courses").delete().eq("id", String(courseId));
        await supabase.from("academy_lessons").delete().eq("course_id", String(courseId));
        invalidateCatalogCache();
      }
      return sendSafeJson(res, 200, { success: true });
    }

    // 7. ADMIN LESSONS CRUD
    if (normalizedPath === "/api/lessons/add" && req.method === "POST") {
      const body = await parseBody();
      const id = String(body.id || body.lessonId || Date.now());
      const { data: countData } = await supabase
        .from("academy_lessons")
        .select("id")
        .eq("course_id", String(body.courseId));
      const nextOrder = (countData?.length || 0) + 1;

      let videoIdToSave = body.videoUrl || "";
      const incomingFileId = body.fileId || body.file_id || undefined;
      if (body.videoUrl && (body.videoFormat || body.thumbnailUrl || incomingFileId)) {
        videoIdToSave = JSON.stringify({
          url: body.videoUrl,
          file_id: incomingFileId,
          format: body.videoFormat || "shorts",
          thumb: body.thumbnailUrl || "",
        });
      }

      const lessonRecord = {
        id,
        course_id: String(body.courseId),
        title: body.title || "Yangi dars",
        description: body.description || "",
        youtube_video_id: videoIdToSave,
        duration_seconds: Number(body.durationSeconds) || 600,
        order: body.order ? Number(body.order) : nextOrder,
      };

      const { data, error } = await supabase
        .from("academy_lessons")
        .upsert(lessonRecord, { onConflict: "id" })
        .select()
        .single();

      if (error) {
        console.error("Lesson upsert error:", error);
        return sendSafeJson(res, 500, { error: error.message });
      }
      invalidateCatalogCache();

      return sendSafeJson(res, 200, {
        success: true,
        lessonId: id,
        lesson: {
          id,
          courseId: lessonRecord.course_id,
          title: lessonRecord.title,
          description: lessonRecord.description,
          duration: body.duration || "10:00",
          durationSeconds: lessonRecord.duration_seconds,
          videoUrl: body.videoUrl || "",
          videoFormat: body.videoFormat || "shorts",
          thumbnailUrl: body.thumbnailUrl || "",
          status: "Faol",
          color: "lesson-blue",
        },
      });
    }

    if (normalizedPath === "/api/lessons/update" && req.method === "POST") {
      const body = await parseBody();
      const lessonId = body.id || body.lessonId;
      if (lessonId) {
        let videoIdToSave = body.videoUrl;
        const { data: cur } = await supabase
          .from("academy_lessons")
          .select("youtube_video_id")
          .eq("id", String(lessonId))
          .maybeSingle();

        let curParsed = {};
        try {
          if (cur?.youtube_video_id?.startsWith("{")) {
            curParsed = JSON.parse(cur.youtube_video_id);
          }
        } catch {}

        const incomingFileId = body.fileId || body.file_id || undefined;
        if (body.videoUrl && (body.videoFormat || body.thumbnailUrl || incomingFileId)) {
          const keepFileId = incomingFileId || (curParsed.url === body.videoUrl ? curParsed.file_id : undefined);
          videoIdToSave = JSON.stringify({
            url: body.videoUrl,
            format: body.videoFormat || "shorts",
            thumb: body.thumbnailUrl || "",
            ...(keepFileId ? { file_id: keepFileId } : {}),
          });
        } else if (!body.videoUrl && (body.videoFormat || body.thumbnailUrl || incomingFileId)) {
          let curRaw = curParsed.url || cur?.youtube_video_id || "";
          if (curRaw) {
            videoIdToSave = JSON.stringify({
              url: curRaw,
              format: body.videoFormat || "shorts",
              thumb: body.thumbnailUrl || "",
              ...((incomingFileId || curParsed.file_id) ? { file_id: incomingFileId || curParsed.file_id } : {}),
            });
          }
        }

        const updateData = {
          updated_at: new Date().toISOString(),
        };
        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (videoIdToSave !== undefined) updateData.youtube_video_id = videoIdToSave;
        if (body.durationSeconds !== undefined) updateData.duration_seconds = Number(body.durationSeconds);
        if (body.courseId !== undefined) updateData.course_id = String(body.courseId);

        const { error } = await supabase
          .from("academy_lessons")
          .update(updateData)
          .eq("id", String(lessonId));

        if (error) {
          console.error("Lesson update error:", error);
          return sendSafeJson(res, 500, { error: error.message });
        }
        invalidateCatalogCache();
      }
      return sendSafeJson(res, 200, { success: true });
    }

    if (normalizedPath === "/api/lessons/delete" && req.method === "POST") {
      const body = await parseBody();
      const lessonId = body.id || body.lessonId;
      if (lessonId) {
        const { error } = await supabase
          .from("academy_lessons")
          .delete()
          .eq("id", String(lessonId));

        if (error) {
          console.error("Lesson delete error:", error);
          return sendSafeJson(res, 500, { error: error.message });
        }
        await supabase
          .from("academy_user_progress")
          .delete()
          .eq("lesson_id", String(lessonId));
        invalidateCatalogCache();
      }
      return sendSafeJson(res, 200, { success: true });
    }

    return sendSafeJson(res, 404, { error: "API endpoint topilmadi", path: normalizedPath });
  } catch (err) {
    console.error("API Error:", err);
    return sendSafeJson(res, 500, { error: err?.message || "Server error" });
  }
}
