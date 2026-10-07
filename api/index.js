import { createClient } from "@supabase/supabase-js";

// --- Configuration & Constants ---
const DEFAULT_SUPABASE_URL = "https://dajlwaqoqcnwrrhyvmtw.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhamx3YXFvcWNud3JyaHl2bXR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIwOTk4NSwiZXhwIjoyMTA2Nzg1OTg1fQ.12KfEAK7aU17B2bidfcxeag8P0yLlKJq8QAhoq5mhAs";
const DEFAULT_BOT_TOKEN = "8692358170:AAGvDJ9-5Ckuk8rGZSC6zAhsdM-mqTc0Ewo";
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

function isAdmin(telegramUserId) {
  if (!telegramUserId) return false;
  const id = Number(telegramUserId);
  const envAdmins = (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ADMIN_TELEGRAM_IDS.includes(id) || envAdmins.includes(id);
}

// --- Telegram API Utilities ---
async function callTelegram(method, params = {}) {
  const token = getBotToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
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
  // Try sending native video with DRM protect_content
  const sent = await callTelegram("sendVideo", {
    chat_id: chatId,
    video,
    caption,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    protect_content: protectContent, // 🔒 NATIVE OS-LEVEL DRM
  });

  if (!sent || !sent.ok) {
    console.warn("sendVideo fallback to sendMessage:", sent?.description);
    return await callTelegram("sendMessage", {
      chat_id: chatId,
      text: `${caption}\n\n🎥 <b>Video havolasi:</b>\n${video}`,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
      protect_content: protectContent,
    });
  }
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
  const { data: accessRows } = await supabase
    .from("academy_access")
    .select("course_id")
    .eq("user_id", userId)
    .eq("status", "granted");

  if (!accessRows || accessRows.length === 0) return [];
  const courseIds = accessRows.map((r) => String(r.course_id));

  const { data: courses } = await supabase
    .from("academy_courses")
    .select("*")
    .in("id", courseIds)
    .eq("active", true)
    .order("order", { ascending: true });

  return courses || [];
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

// --- Bot Menus & Action Handlers ---
async function showCoursesMenu(chatId, user, messageId = null) {
  const supabase = getSupabase();
  const granted = await getGrantedCourses(supabase, user.id);

  if (granted.length === 0) {
    const text =
      `⏳ <b>Hurmatli ${user.name}!</b>\n\n` +
      `👤 <b>Mijoz kodi:</b> <code>${user.customer_code}</code>\n` +
      `📱 <b>Telefon:</b> <code>${user.phone}</code>\n\n` +
      `⚠️ <b>Holat: Administrator ruxsati kutilmoqda.</b>\n` +
      `Administrator darslarni ko‘rish uchun ruxsat bergach, ushbu bot orqali xabar keladi va darslar ochiladi.`;

    if (messageId) {
      await callTelegram("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
      });
    } else {
      await sendTelegramMessage(chatId, text);
    }
    return;
  }

  const buttons = granted.map((c) => [
    { text: `📚 ${c.title}`, callback_data: `course_${c.id}` },
  ]);

  const text =
    `🎓 <b>Mening kurslarim</b>\n\n` +
    `Darslarni tomosha qilish uchun kursni tanlang 👇`;

  if (messageId) {
    await callTelegram("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await sendTelegramMessage(chatId, text, { inline_keyboard: buttons });
  }
}

async function showCourseLessons(chatId, user, courseId, messageId = null) {
  const supabase = getSupabase();

  // 1. Strict Security Gating: verify access
  const hasAccess = await hasAccessToCourse(supabase, user.id, courseId);
  if (!hasAccess) {
    await sendTelegramMessage(
      chatId,
      `🔒 <b>Ushbu kursga ruxsat berilmagan!</b>\n\nIltimos, administrator bilan bog‘laning.`
    );
    return;
  }

  // 2. Fetch course & lessons
  const { data: course } = await supabase
    .from("academy_courses")
    .select("*")
    .eq("id", String(courseId))
    .maybeSingle();

  const { data: lessons } = await supabase
    .from("academy_lessons")
    .select("*")
    .eq("course_id", String(courseId))
    .order("order", { ascending: true });

  if (!course || !lessons || lessons.length === 0) {
    const text = `📖 <b>${course?.title || "Kurs"}</b>\n\nUshbu kursda hozircha darslar mavjud emas.`;
    const backBtn = { inline_keyboard: [[{ text: "🔙 Kurslarga qaytish", callback_data: "menu_courses" }]] };
    if (messageId) {
      await callTelegram("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", reply_markup: backBtn });
    } else {
      await sendTelegramMessage(chatId, text, backBtn);
    }
    return;
  }

  // 3. Fetch user progress for this course's lessons
  const lessonIds = lessons.map((l) => String(l.id));
  const { data: progressRows } = await supabase
    .from("academy_user_progress")
    .select("lesson_id, completed")
    .eq("user_id", user.id)
    .in("lesson_id", lessonIds);

  const completedMap = {};
  if (progressRows) {
    for (const p of progressRows) {
      if (p.completed) completedMap[String(p.lesson_id)] = true;
    }
  }

  // 4. Build sequential lock buttons
  const buttons = [];
  let canAccessNext = true;

  for (let i = 0; i < lessons.length; i++) {
    const l = lessons[i];
    const isCompleted = Boolean(completedMap[String(l.id)]);
    let icon = "🔒";
    let cb = `locked_${i + 1}`;

    if (isCompleted) {
      icon = "✅";
      cb = `play_${l.id}`;
    } else if (canAccessNext) {
      icon = "▶️";
      cb = `play_${l.id}`;
    }

    buttons.push([{ text: `${icon} ${i + 1}-dars: ${l.title}`, callback_data: cb }]);
    canAccessNext = isCompleted;
  }

  buttons.push([{ text: "🔙 Kurslarga qaytish", callback_data: "menu_courses" }]);

  const completedCount = Object.keys(completedMap).length;
  const pct = Math.round((completedCount / lessons.length) * 100);

  const text =
    `📖 <b>${course.title}</b>\n\n` +
    (course.description ? `<i>${course.description}</i>\n\n` : "") +
    `📊 <b>Kurs jarayoni:</b> ${completedCount}/${lessons.length} dars (${pct}%)\n\n` +
    `👇 Darsni tanlang:`;

  if (messageId) {
    await callTelegram("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await sendTelegramMessage(chatId, text, { inline_keyboard: buttons });
  }
}

async function playLessonVideo(chatId, user, lessonId) {
  const supabase = getSupabase();

  const { data: lesson } = await supabase
    .from("academy_lessons")
    .select("*")
    .eq("id", String(lessonId))
    .maybeSingle();

  if (!lesson) {
    await sendTelegramMessage(chatId, "⚠️ Dars topilmadi.");
    return;
  }

  // Strict Security Check: Verify user course access
  const hasAccess = await hasAccessToCourse(supabase, user.id, lesson.course_id);
  if (!hasAccess) {
    await sendTelegramMessage(chatId, "🔒 Ushbu darsga ruxsatingiz yo‘q.");
    return;
  }

  // Extract video URL / Telegram file_id
  let videoSource = lesson.youtube_video_id || "";
  try {
    if (videoSource.startsWith("{")) {
      const parsed = JSON.parse(videoSource);
      videoSource = parsed.url || videoSource;
    }
  } catch {}

  const m = Math.floor((lesson.duration_seconds || 600) / 60);
  const s = (lesson.duration_seconds || 600) % 60;
  const durationStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const buttons = [
    [{ text: "✅ Darsni ko‘rib bo‘ldim (Tugatish)", callback_data: `finish_${lesson.id}` }],
    [{ text: "📋 Darslar ro‘yxatiga qaytish", callback_data: `course_${lesson.course_id}` }],
  ];

  if (!videoSource) {
    await sendTelegramMessage(
      chatId,
      `🎬 <b>${lesson.title}</b>\n\nUshbu dars uchun video hali biriktirilmagan. Tez orada yuklanadi!`,
      { inline_keyboard: buttons }
    );
    return;
  }

  const caption =
    `🎬 <b>${lesson.title}</b>\n\n` +
    `⏱ <b>Davomiyligi:</b> ${durationStr}\n` +
    (lesson.description ? `📖 <b>Tavsif:</b> ${lesson.description}\n\n` : "\n") +
    `🔒 <i>Xavfsizlik: Ushbu video himoyalangan. Saqlash, ulashish va ekran yozib olish (screen recording) bloklangan.</i>`;

  // Send protected video (DRM)
  await sendTelegramVideo(chatId, videoSource, caption, { inline_keyboard: buttons }, true);
}

async function finishLesson(chatId, user, lessonId) {
  const supabase = getSupabase();

  const { data: lesson } = await supabase
    .from("academy_lessons")
    .select("*")
    .eq("id", String(lessonId))
    .maybeSingle();

  if (!lesson) return;

  // Persist progress to Supabase
  await supabase.from("academy_user_progress").upsert(
    {
      user_id: user.id,
      lesson_id: String(lesson.id),
      completed: true,
      max_watched_seconds: lesson.duration_seconds || 60,
      last_sync_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  // Find next lesson
  const { data: allLessons } = await supabase
    .from("academy_lessons")
    .select("*")
    .eq("course_id", lesson.course_id)
    .order("order", { ascending: true });

  const currentIndex = (allLessons || []).findIndex((l) => String(l.id) === String(lesson.id));
  const nextLesson = allLessons && currentIndex >= 0 ? allLessons[currentIndex + 1] : null;

  if (nextLesson) {
    await sendTelegramMessage(
      chatId,
      `🎉 <b>Ajoyib, ${user.name}!</b>\n\n` +
        `Siz <b>«${lesson.title}»</b> darsini muvaffaqiyatli yakunladingiz!\n\n` +
        `Keyingi dars ochildi: <b>«${nextLesson.title}»</b> 👇`,
      {
        inline_keyboard: [
          [{ text: `▶️ Keyingi dars: ${nextLesson.title}`, callback_data: `play_${nextLesson.id}` }],
          [{ text: "📋 Darslar ro‘yxati", callback_data: `course_${lesson.course_id}` }],
        ],
      }
    );
  } else {
    await sendTelegramMessage(
      chatId,
      `🏆 <b>TABRIKLAYMIZ, ${user.name}!</b>\n\n` +
        `Siz kursdagi barcha darslarni to‘liq yakunladingiz! (100%)\n\n` +
        `Bilimlaringizni amalda qo‘llashingizda muvaffaqiyat tilaymiz!`,
      {
        inline_keyboard: [
          [{ text: "📋 Kurslar ro‘yxatiga qaytish", callback_data: "menu_courses" }],
        ],
      }
    );
  }
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

    const user = await findUserByTelegramId(supabase, telegramUserId);
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

    if (data.startsWith("play_")) {
      const lessonId = data.replace("play_", "");
      await playLessonVideo(chatId, user, lessonId);
      return true;
    }

    if (data.startsWith("finish_")) {
      const lessonId = data.replace("finish_", "");
      await finishLesson(chatId, user, lessonId);
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
    const customerCode = existingUser?.customer_code || `YK-${Math.floor(100 + Math.random() * 900)}`;

    const { data: userRow } = await supabase
      .from("users")
      .upsert(
        {
          telegram_user_id: telegramUserId,
          name: fullName,
          phone,
          customer_code: customerCode,
          status: existingUser?.status || "pending", // PENDING UNTIL ADMIN APPROVAL
          onboarding_completed: true,
          onboarding_step: "completed",
          phone_verified_at: new Date().toISOString(),
        },
        { onConflict: "telegram_user_id" }
      )
      .select()
      .single();

    // Remove keyboard and send waiting status message
    await sendTelegramMessage(
      chatId,
      `✅ <b>Raqamingiz tasdiqlandi:</b> <code>${phone}</code>\n\n` +
        `👤 <b>Mijoz kodi:</b> <code>${customerCode}</code>\n` +
        `📱 <b>Ism:</b> ${fullName}\n\n` +
        `⏳ <b>Sizning arizangiz qabul qilindi.</b>\n` +
        `Administrator darslarni ko‘rish uchun ruxsat bergach, ushbu bot orqali darhol xabarnoma olasiz va darslar ochiladi!`,
      { remove_keyboard: true }
    );
    return true;
  }

  // 3. Handle Admin Video Upload (200-300MB+ Direct Upload via Telegram)
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

  // 4. Handle Text Messages (/start, /courses, etc.)
  if (message?.text) {
    const text = message.text.trim();

    if (text.startsWith("/start")) {
      const user = await findUserByTelegramId(supabase, telegramUserId);

      // A. Not registered yet -> Ask for contact button
      if (!user || !user.phone) {
        const welcomeText =
          `👋 <b>Assalomu alaykum, ${from.first_name || "Talaba"}!</b>\n\n` +
          `Yukla Go video ta’lim platformasiga xush kelibsiz.\n\n` +
          `Kurs darslariga ro‘yxatdan o‘tish uchun quyidagi tugmani bosib <b>telefon raqamingizni tasdiqlang</b>:`;

        await sendTelegramMessage(chatId, welcomeText, {
          keyboard: [
            [{ text: "📱 Telefon raqamimni yuborish", request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        });
        return true;
      }

      // B. Registered -> Remove legacy keyboards and show status/courses
      await sendTelegramMessage(
        chatId,
        `📚 <b>Yukla Go ta’lim platformasi</b>`,
        { remove_keyboard: true }
      );
      await showCoursesMenu(chatId, user);
      return true;
    }

    if (text.startsWith("/courses") || text === "📚 Kurslar" || text === "Darslar") {
      const user = await findUserByTelegramId(supabase, telegramUserId);
      if (user) {
        await showCoursesMenu(chatId, user);
        return true;
      }
    }

    // Default fallback
    const user = await findUserByTelegramId(supabase, telegramUserId);
    if (!user) {
      await sendTelegramMessage(
        chatId,
        `Assalomu alaykum! Iltimos, /start buyrug‘ini bosing va ro‘yxatdan o‘ting.`
      );
      return true;
    }
    await showCoursesMenu(chatId, user);
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

    // 6. STATE ENDPOINT (Used by Admin Panel)
    if (normalizedPath === "/api/state" || normalizedPath === "/api" || normalizedPath === "") {
      const { data: dbCourses } = await supabase
        .from("academy_courses")
        .select("*")
        .order("order", { ascending: true });

      const { data: dbLessons } = await supabase
        .from("academy_lessons")
        .select("*")
        .order("order", { ascending: true });

      const { data: dbUsers } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: dbAccess } = await supabase.from("academy_access").select("*");

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
        let videoFormat = "standard";
        let thumbnailUrl = "";
        try {
          if (videoUrl.startsWith("{")) {
            const parsed = JSON.parse(videoUrl);
            videoUrl = parsed.url || "";
            videoFormat = parsed.format || "standard";
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

        return {
          id: u.customer_code || u.id,
          supabaseId: u.id,
          telegramId: u.telegram_user_id,
          name: u.name || "Talaba",
          initials,
          phone: u.phone || "",
          access: u.status === "active" ? "Faol" : "Kutilmoqda",
          coursesAccess: accessMap[u.id] || {},
          progress: 0,
          done: `0 / ${lessons.length}`,
          activity: "Faol",
        };
      });

      return sendSafeJson(res, 200, {
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
      });
    }

    // 3. ADMIN ACCESS PERMISSION ENDPOINT (/api/users/access)
    if (normalizedPath === "/api/users/access" && req.method === "POST") {
      const body = await parseBody();
      const { userIds, courseId, access } = body;

      if (!Array.isArray(userIds) || !access) {
        return sendSafeJson(res, 400, { error: "Parametrlar noto‘g‘ri" });
      }

      for (const uid of userIds) {
        // Find user by customer_code or uuid
        const { data: user } = await supabase
          .from("users")
          .select("*")
          .or(`customer_code.eq.${uid},id.eq.${uid},telegram_user_id.eq.${isNaN(Number(uid)) ? 0 : Number(uid)}`)
          .maybeSingle();

        if (user) {
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
            }
            // Set user status to active
            await supabase.from("users").update({ status: "active" }).eq("id", user.id);

            // INSTANT TELEGRAM NOTIFICATION TO STUDENT
            if (user.telegram_user_id) {
              const { data: courseRow } = await supabase
                .from("academy_courses")
                .select("title")
                .eq("id", String(courseId))
                .maybeSingle();

              const courseTitle = courseRow?.title || "Video darslar";

              await sendTelegramMessage(
                user.telegram_user_id,
                `🎉 <b>Ajoyib yangilik, ${user.name || "Talaba"}!</b>\n\n` +
                  `Administrator sizga <b>«${courseTitle}»</b> darslarini ko‘rish uchun ruxsat berdi!\n\n` +
                  `Quyidagi tugma orqali darslarni hoziroq boshlashingiz mumkin 👇`,
                {
                  inline_keyboard: [
                    [{ text: "📚 Kurs darslarini boshlash", callback_data: `course_${courseId}` }],
                  ],
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
            }
          }
        }
      }

      return sendSafeJson(res, 200, { success: true });
    }

    // 4. ADMIN USER DELETE ENDPOINT (/api/users/delete)
    if (normalizedPath === "/api/users/delete" && req.method === "POST") {
      const { userId } = await parseBody();
      if (userId) {
        await supabase
          .from("users")
          .delete()
          .or(`customer_code.eq.${userId},id.eq.${userId}`);
      }
      return sendSafeJson(res, 200, { success: true });
    }

    // 5. ADMIN COURSES CRUD
    if (normalizedPath === "/api/courses/add" && req.method === "POST") {
      const { title, description } = await parseBody();
      const id = String(Date.now());
      await supabase.from("academy_courses").insert({
        id,
        title: title || "Yangi kurs",
        description: description || "",
        active: true,
        order: 1,
      });
      return sendSafeJson(res, 200, { success: true, courseId: id });
    }

    if (normalizedPath === "/api/courses/update" && req.method === "POST") {
      const { id, title, description, status } = await parseBody();
      if (id) {
        await supabase
          .from("academy_courses")
          .update({
            title,
            description,
            active: status === "Faol",
            updated_at: new Date().toISOString(),
          })
          .eq("id", String(id));
      }
      return sendSafeJson(res, 200, { success: true });
    }

    if (normalizedPath === "/api/courses/delete" && req.method === "POST") {
      const { id } = await parseBody();
      if (id) {
        await supabase.from("academy_courses").delete().eq("id", String(id));
        await supabase.from("academy_lessons").delete().eq("course_id", String(id));
      }
      return sendSafeJson(res, 200, { success: true });
    }

    // 6. ADMIN LESSONS CRUD
    if (normalizedPath === "/api/lessons/add" && req.method === "POST") {
      const body = await parseBody();
      const id = String(Date.now());
      await supabase.from("academy_lessons").insert({
        id,
        course_id: String(body.courseId),
        title: body.title || "Yangi dars",
        description: body.description || "",
        youtube_video_id: body.videoUrl || "",
        duration_seconds: body.durationSeconds || 600,
        order: 1,
      });
      return sendSafeJson(res, 200, { success: true, lessonId: id });
    }

    if (normalizedPath === "/api/lessons/update" && req.method === "POST") {
      const body = await parseBody();
      if (body.id) {
        await supabase
          .from("academy_lessons")
          .update({
            title: body.title,
            description: body.description,
            youtube_video_id: body.videoUrl,
            duration_seconds: body.durationSeconds,
            updated_at: new Date().toISOString(),
          })
          .eq("id", String(body.id));
      }
      return sendSafeJson(res, 200, { success: true });
    }

    if (normalizedPath === "/api/lessons/delete" && req.method === "POST") {
      const { id } = await parseBody();
      if (id) {
        await supabase.from("academy_lessons").delete().eq("id", String(id));
      }
      return sendSafeJson(res, 200, { success: true });
    }

    return sendSafeJson(res, 404, { error: "API endpoint topilmadi", path: normalizedPath });
  } catch (err) {
    console.error("API Error:", err);
    return sendSafeJson(res, 500, { error: err?.message || "Server error" });
  }
}
