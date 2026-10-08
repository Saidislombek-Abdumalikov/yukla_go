import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "8692358170:AAGvDJ9-5Ckuk8rGZSC6zAhsdM-mqTc0Ewo";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://dajlwaqoqcnwrrhyvmtw.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhamx3YXFvcWNud3JyaHl2bXR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIwOTk4NSwiZXhwIjoyMTA2Nzg1OTg1fQ.12KfEAK7aU17B2bidfcxeag8P0yLlKJq8QAhoq5mhAs";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000/api";

const DB_FILE = path.join(__dirname, "..", "database.json");

// Initialize Supabase
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("✅ Supabase ulandi");
  } catch (err) {
    console.warn("⚠️ Supabase ulanish xatosi:", err.message);
  }
}

// Database Helpers
function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("database.json o‘qishda xatolik:", err.message);
  }
  return { users: [], courses: [], lessons: [], settings: {}, progress: {} };
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("database.json yozishda xatolik:", err.message);
  }
}

// Telegram API Helper
async function callTelegram(method, params = {}) {
  if (!BOT_TOKEN) return null;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API xatoligi [${method}]:`, err.message);
    return null;
  }
}

// Notify sync-server to refresh Admin Panel state
async function notifySyncServer() {
  try {
    await fetch(`${API_BASE_URL}/state`, { method: "GET" });
  } catch {}
}

// Find user by Telegram ID
function findUserByTelegramId(telegramId) {
  const db = readDb();
  return db.users.find(
    (u) =>
      String(u.telegramId) === String(telegramId) ||
      String(u.telegram_user_id) === String(telegramId)
  );
}

// Check if user has active access to at least one course
function hasActiveAccess(user) {
  if (!user) return false;
  if (user.access === "To‘xtatilgan" || user.access === "Kutilmoqda") return false;
  if (user.access === "Faol") return true;
  if (user.coursesAccess && Object.values(user.coursesAccess).some((st) => st === "Faol")) {
    return true;
  }
  return false;
}

// Check access to a specific course
function hasCourseAccess(user, courseId) {
  if (!user) return false;
  if (user.access === "To‘xtatilgan") return false;
  if (user.coursesAccess && user.coursesAccess[String(courseId)] === "Faol") return true;
  if (user.coursesAccess && user.coursesAccess[Number(courseId)] === "Faol") return true;
  if (user.access === "Faol" && (!user.coursesAccess || Object.keys(user.coursesAccess).length === 0)) {
    return true;
  }
  return false;
}

// --- Menu Handlers ---

// 1. Show Courses Menu
async function showCoursesMenu(chatId, messageId, user) {
  const db = readDb();
  const accessibleCourses = db.courses.filter(
    (c) => c.status === "Faol" && hasCourseAccess(user, c.id)
  );

  if (accessibleCourses.length === 0) {
    const text =
      `⏳ <b>Hurmatli ${user.name}!</b>\n\n` +
      `Siz ro‘yxatdan o‘tgansiz, ammo hozircha sizga biriktirilgan faol kurslar mavjud emas.\n\n` +
      `Administrator ruxsat bergach, bu yerda darslaringiz ko‘rinadi.`;

    if (messageId) {
      await callTelegram("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
      });
    } else {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      });
    }
    return;
  }

  const buttons = accessibleCourses.map((c) => [
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
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

// 2. Show Lessons inside Course
async function showCourseLessons(chatId, messageId, user, courseId) {
  const db = readDb();
  const course = db.courses.find((c) => String(c.id) === String(courseId));
  if (!course) {
    return showCoursesMenu(chatId, messageId, user);
  }

  const lessons = db.lessons.filter(
    (l) =>
      String(l.courseId) === String(courseId) &&
      l.status !== "Qoralama" &&
      l.status !== "Yashirilgan"
  );

  if (lessons.length === 0) {
    const text =
      `📖 <b>${course.title}</b>\n\n` +
      `Ushbu kursga hozircha darslar yuklanmagan. Tez orada yuklanadi!`;

    const buttons = [
      [{ text: "🔙 Kurslarga qaytish", callback_data: "menu_courses" }],
    ];

    if (messageId) {
      await callTelegram("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      });
    } else {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      });
    }
    return;
  }

  const userProgress =
    db.progress[user.id] ||
    db.progress[user.telegramId] ||
    (user.supabaseId ? db.progress[user.supabaseId] : null) ||
    {};

  const buttons = [];
  let canAccessNext = true; // Sequential unlock: 1st lesson unlocked, subsequent only if previous completed

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    const isCompleted = Boolean(userProgress[lesson.id]?.completed);
    const isUnlocked = canAccessNext;

    let icon = "🔒";
    let cb = `locked_${i + 1}`;

    if (isCompleted) {
      icon = "✅";
      cb = `play_${lesson.id}`;
    } else if (isUnlocked) {
      icon = "▶️";
      cb = `play_${lesson.id}`;
    }

    buttons.push([
      {
        text: `${icon} ${i + 1}-dars: ${lesson.title}`,
        callback_data: cb,
      },
    ]);

    canAccessNext = isCompleted;
  }

  buttons.push([{ text: "🔙 Kurslarga qaytish", callback_data: "menu_courses" }]);

  const completedCount = lessons.filter(
    (l) => userProgress[l.id]?.completed
  ).length;
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
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

// 3. Send Lesson Video with Screen Recording & Copying Restriction (protect_content: true)
async function sendLessonVideo(chatId, user, lessonId) {
  const db = readDb();
  const lesson = db.lessons.find((l) => String(l.id) === String(lessonId));
  if (!lesson) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "⚠️ Dars topilmadi.",
    });
    return;
  }

  const courseLessons = db.lessons.filter(
    (l) =>
      String(l.courseId) === String(lesson.courseId) &&
      l.status !== "Qoralama" &&
      l.status !== "Yashirilgan"
  );
  const lessonIndex =
    courseLessons.findIndex((l) => String(l.id) === String(lesson.id)) + 1;

  if (!lesson.videoUrl) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text:
        `🎬 <b>${lessonIndex}-dars: ${lesson.title}</b>\n\n` +
        `Ushbu dars uchun video hali biriktirilmagan. Tez orada yuklanadi!`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Darslar ro‘yxatiga qaytish", callback_data: `course_${lesson.courseId}` }],
        ],
      },
    });
    return;
  }

  const caption =
    `🎬 <b>${lessonIndex}-dars: ${lesson.title}</b>\n\n` +
    (lesson.duration ? `⏱ <b>Davomiyligi:</b> ${lesson.duration}\n` : "") +
    (lesson.description ? `📖 <b>Tavsif:</b> ${lesson.description}\n\n` : "\n") +
    `🔒 <i>Xavfsizlik: Ushbu video himoyalangan. Saqlash, ulashish va ekran yozib olish (screen recording) bloklangan.</i>`;

  const buttons = [
    [
      {
        text: "✅ Darsni ko‘rib bo‘ldim (Tugatish)",
        callback_data: `finish_${lesson.id}`,
      },
    ],
    [
      {
        text: "📋 Darslar ro‘yxati",
        callback_data: `course_${lesson.courseId}`,
      },
    ],
  ];

  // Send native Telegram video with PROTECT CONTENT (Anti-forward, anti-save, anti-recording!)
  const sent = await callTelegram("sendVideo", {
    chat_id: chatId,
    video: lesson.videoUrl,
    protect_content: true, // 🔒 NATIVE COPY & SCREEN RECORDING RESTRICTION
    caption,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });

  // If videoUrl is an external URL that Telegram couldn't fetch directly, notify nicely
  if (!sent || !sent.ok) {
    console.warn("sendVideo failed with direct URL, sending message:", sent?.description);
    await callTelegram("sendMessage", {
      chat_id: chatId,
      protect_content: true,
      text:
        `🎬 <b>${lessonIndex}-dars: ${lesson.title}</b>\n\n` +
        (lesson.duration ? `⏱ <b>Davomiyligi:</b> ${lesson.duration}\n` : "") +
        (lesson.description ? `📖 <b>Tavsif:</b> ${lesson.description}\n\n` : "\n") +
        `🎥 <b>Video havolasi:</b>\n${lesson.videoUrl}`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

// 4. Mark Lesson as Finished and Unlock Next
async function finishLesson(chatId, user, lessonId) {
  const db = readDb();
  const lesson = db.lessons.find((l) => String(l.id) === String(lessonId));
  if (!lesson) return;

  const uid = user.id;
  db.progress = db.progress || {};
  db.progress[uid] = db.progress[uid] || {};
  db.progress[uid][lesson.id] = {
    current: lesson.durationSeconds || 60,
    maxWatched: lesson.durationSeconds || 60,
    completed: true,
  };

  if (user.telegramId) {
    db.progress[user.telegramId] = db.progress[uid];
  }
  if (user.supabaseId) {
    db.progress[user.supabaseId] = db.progress[uid];
  }

  // Recalculate progress
  const allLessons = db.lessons.filter(
    (l) => l.status !== "Qoralama" && l.status !== "Yashirilgan"
  );
  const completedCount = allLessons.filter(
    (l) => db.progress[uid]?.[l.id]?.completed
  ).length;
  const pct =
    allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  db.users = db.users.map((u) => {
    if (u.id === user.id || String(u.telegramId) === String(user.telegramId)) {
      return {
        ...u,
        progress: pct,
        done: `${completedCount} / ${allLessons.length}`,
        activity: `Hozirgina darsni yakunladi`,
      };
    }
    return u;
  });

  writeDb(db);
  notifySyncServer();

  // Save to Supabase if connected
  if (supabase && user.supabaseId) {
    try {
      await supabase.from("academy_user_progress").upsert(
        {
          user_id: user.supabaseId,
          lesson_id: String(lesson.id),
          completed: true,
          watched_seconds: lesson.durationSeconds || 60,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" }
      );
    } catch {}
  }

  // Find next lesson
  const courseLessons = db.lessons.filter(
    (l) =>
      String(l.courseId) === String(lesson.courseId) &&
      l.status !== "Qoralama" &&
      l.status !== "Yashirilgan"
  );
  const currIdx = courseLessons.findIndex(
    (l) => String(l.id) === String(lesson.id)
  );
  const nextLesson = courseLessons[currIdx + 1];

  if (nextLesson) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text:
        `🎉 <b>Ajoyib! ${currIdx + 1}-dars muvaffaqiyatli yakunlandi!</b>\n\n` +
        `Siz uchun <b>${currIdx + 2}-dars: ${nextLesson.title}</b> ochildi. Davom etamizmi?`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `▶️ ${currIdx + 2}-darsni ko‘rish`,
              callback_data: `play_${nextLesson.id}`,
            },
          ],
          [
            {
              text: "📋 Darslar ro‘yxati",
              callback_data: `course_${lesson.courseId}`,
            },
          ],
        ],
      },
    });
  } else {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text:
        `🏆 <b>TABRIKLAYMIZ!</b>\n\n` +
        `Siz ushbu kursdagi barcha darslarni to‘liq muvaffaqiyatli yakunladingiz!\n\n` +
        `Natijangiz: <b>100%</b> tayyor.`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📋 Kurslar ro‘yxatiga qaytish", callback_data: "menu_courses" }],
        ],
      },
    });
  }
}

// 5. /start Command Handler
async function handleStartCommand(chatId, from) {
  const user = findUserByTelegramId(from.id);
  const fullName =
    `${from.first_name || ""} ${from.last_name || ""}`.trim() ||
    from.username ||
    "Talaba";

  // Case 1: Not registered yet -> Ask for contact button
  if (!user) {
    const text =
      `👋 <b>Assalomu alaykum, ${fullName}!</b>\n\n` +
      `Yukla Go video ta’lim platformasiga xush kelibsiz.\n\n` +
      `Kurs darslariga ro‘yxatdan o‘tish uchun quyidagi tugmani bosib <b>telefon raqamingizni tasdiqlang</b>:`;

    await callTelegram("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: {
        keyboard: [
          [{ text: "📱 Telefon raqamimni yuborish", request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return;
  }

  // Case 2: Registered, but access is not approved yet
  if (!hasActiveAccess(user)) {
    const text =
      `⏳ <b>Assalomu alaykum, ${user.name}!</b>\n\n` +
      `Sizning arizangiz qabul qilingan.\n\n` +
      `👤 <b>Mijoz kodi:</b> <code>${user.id}</code>\n` +
      `📱 <b>Telefon:</b> <code>${user.phone}</code>\n\n` +
      `⚠️ <b>Holat: Administrator ruxsati kutilmoqda.</b>\n` +
      `Administrator darslarni ko‘rish uchun ruxsat bergach, sizga ushbu bot orqali xabar keladi va darslar ochiladi.`;

    await callTelegram("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { remove_keyboard: true },
    });
    return;
  }

  // Case 3: Registered & Approved -> Remove any legacy keyboard and show Courses
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "📚 <b>Yukla Go ta’lim platformasi</b>",
    parse_mode: "HTML",
    reply_markup: { remove_keyboard: true },
  });
  await showCoursesMenu(chatId, null, user);
}

// 6. Contact Received Handler (Phone Number Button tapped)
async function handleContactReceived(chatId, contact, from) {
  let phone = contact.phone_number.trim();
  if (!phone.startsWith("+")) phone = "+" + phone;

  const fullName =
    `${from.first_name || ""} ${from.last_name || ""}`.trim() ||
    contact.first_name ||
    "Talaba";

  const initials =
    fullName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "T";

  const db = readDb();
  let user = db.users.find(
    (u) =>
      String(u.telegramId) === String(from.id) ||
      u.phone.replace(/\D/g, "") === phone.replace(/\D/g, "")
  );

  let customerCode = user?.id || `YK-${Math.floor(100 + Math.random() * 900)}`;

  if (!user) {
    user = {
      id: customerCode,
      telegramId: from.id,
      name: fullName,
      initials,
      phone,
      registeredAt: new Date().toLocaleDateString("uz-UZ"),
      coursesAccess: {},
      access: "Kutilmoqda", // WAITING FOR ADMIN APPROVAL
      progress: 0,
      done: `0 / ${db.lessons.length}`,
      activity: "Hozirgina ro‘yxatdan o‘tdi",
    };
    db.users.unshift(user);
    writeDb(db);
    notifySyncServer();

    // Sync to Supabase if connected
    if (supabase) {
      try {
        const { data: supaUser } = await supabase
          .from("users")
          .insert({
            telegram_user_id: from.id,
            customer_code: customerCode,
            name: fullName,
            phone,
            onboarding_completed: true,
            status: "active",
          })
          .select()
          .maybeSingle();

        if (supaUser) {
          user.supabaseId = supaUser.id;
          writeDb(db);
        }
      } catch (err) {
        console.warn("Supabase insert notice:", err.message);
      }
    }
  } else {
    user.telegramId = from.id;
    user.name = fullName;
    user.phone = phone;
    writeDb(db);
  }

  const text =
    `🎉 <b>Rahmat, ${fullName}!</b>\n\n` +
    `Arizangiz muvaffaqiyatli qabul qilindi.\n\n` +
    `📋 <b>Ma’lumotlaringiz:</b>\n` +
    `• <b>Mijoz kodi:</b> <code>${customerCode}</code>\n` +
    `• <b>Telefon:</b> <code>${phone}</code>\n\n` +
    `⏳ <b>Holat: Administrator tasdiqlashi kutilmoqda.</b>\n` +
    `Admin sizga darslarni ko‘rish uchun ruxsat bergach, bot sizga darhol xabar yuboradi va darslar ochiladi.`;

  await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { remove_keyboard: true },
  });
}

// 7. Video Received Handler (Admin uploading video via Telegram)
async function handleVideoReceived(chatId, video, from) {
  const fileId = video.file_id;
  const durationSec = video.duration || 0;
  const m = Math.floor(durationSec / 60);
  const s = durationSec % 60;
  const durationStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const sizeMB = (video.file_size / (1024 * 1024)).toFixed(1);

  const db = readDb();
  const lessons = db.lessons.slice(0, 8);

  const buttons = lessons.map((l) => [
    {
      text: `🎬 "${l.title}" darsiga biriktirish`,
      callback_data: `attach_${l.id}_${fileId}`,
    },
  ]);

  buttons.push([
    {
      text: "➕ Yangi dars qilib saqlash",
      callback_data: `newlesson_${fileId}_${durationStr}_${durationSec}`,
    },
  ]);

  await callTelegram("sendMessage", {
    chat_id: chatId,
    text:
      `🎬 <b>Video Telegram serveriga yuklandi!</b>\n\n` +
      `📁 <b>Telegram File ID:</b>\n<code>${fileId}</code>\n\n` +
      `⏱ <b>Davomiyligi:</b> ${durationStr}\n` +
      `💾 <b>Hajmi:</b> ${sizeMB} MB\n\n` +
      `Ushbu videoni qaysi darsga biriktiramiz?`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
}

// 8. Callback Query Router
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const from = callbackQuery.from;

  await callTelegram("answerCallbackQuery", { callback_query_id: callbackQuery.id });

  const user = findUserByTelegramId(from.id);
  if (!user) {
    return handleStartCommand(chatId, from);
  }

  // A. Back to Courses Menu
  if (data === "menu_courses") {
    return showCoursesMenu(chatId, messageId, user);
  }

  // B. Open Specific Course
  if (data.startsWith("course_view_")) {
    const courseId = data.replace("course_view_", "");
    return showCourseLessons(chatId, messageId, user, courseId);
  }
  if (data.startsWith("course_")) {
    const courseId = data.replace("course_", "");
    return showCourseLessons(chatId, messageId, user, courseId);
  }

  // C. Play Lesson Video
  if (data.startsWith("play_")) {
    const lessonId = data.replace("play_", "");
    return sendLessonVideo(chatId, user, lessonId);
  }

  // D. Finish Lesson
  if (data.startsWith("finish_")) {
    const lessonId = data.replace("finish_", "");
    return finishLesson(chatId, user, lessonId);
  }

  // E. Locked Lesson Attempt
  if (data.startsWith("locked_")) {
    const lessonNum = data.replace("locked_", "");
    await callTelegram("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: `🔒 Ushbu dars qulflangan! Avvalgi darsni ko‘rib bo‘lishingiz kerak.`,
      show_alert: true,
    });
    return;
  }

  // F. Attach Video to Existing Lesson (Admin)
  if (data.startsWith("attach_")) {
    const parts = data.split("_");
    const lessonId = parts[1];
    const fileId = parts.slice(2).join("_");

    const db = readDb();
    db.lessons = db.lessons.map((l) => {
      if (String(l.id) === String(lessonId)) {
        return { ...l, videoUrl: fileId };
      }
      return l;
    });
    writeDb(db);
    notifySyncServer();

    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: `✅ Video muvaffaqiyatli darsga biriktirildi! Endi o‘quvchilar uni himoyalangan formatda ko‘ra olishadi.`,
    });
    return;
  }

  // G. Create New Lesson with Video (Admin)
  if (data.startsWith("newlesson_")) {
    const parts = data.split("_");
    const fileId = parts[1];
    const durationStr = parts[2] || "10:00";
    const durationSec = Number(parts[3]) || 600;

    const db = readDb();
    const courseId = db.courses[0]?.id || Date.now();
    const newLesson = {
      id: Date.now(),
      courseId,
      title: `Yangi dars (${new Date().toLocaleDateString("uz-UZ")})`,
      duration: durationStr,
      durationSeconds: durationSec,
      videoUrl: fileId,
      videoFormat: "standard",
      thumbnailUrl: "",
      description: "Telegram orqali yuklangan dars",
      status: "Faol",
    };
    db.lessons.push(newLesson);
    writeDb(db);
    notifySyncServer();

    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: `✅ Yangi dars yaratildi va video biriktirildi! Dars nomi: "${newLesson.title}". Admin panelda uni tahrirlashingiz mumkin.`,
    });
  }
}

// 9. Text Message Router
async function handleTextMessage(chatId, text, from) {
  if (text.startsWith("/start")) {
    return handleStartCommand(chatId, from);
  }

  if (text.startsWith("/courses") || text === "📚 Kurslar" || text === "Darslar") {
    const user = findUserByTelegramId(from.id);
    if (user && hasActiveAccess(user)) {
      return showCoursesMenu(chatId, null, user);
    }
  }

  // Default response
  const user = findUserByTelegramId(from.id);
  if (!user) {
    return handleStartCommand(chatId, from);
  }

  if (!hasActiveAccess(user)) {
    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: `⏳ Sizning arizangiz administrator tomonidan ko‘rib chiqilmoqda. Ruxsat berilgach darslar ochiladi.`,
    });
    return;
  }

  await showCoursesMenu(chatId, null, user);
}

// Long-polling loop
let lastUpdateId = 0;

async function pollUpdates() {
  try {
    const data = await callTelegram("getUpdates", {
      offset: lastUpdateId + 1,
      timeout: 25,
    });

    if (data && data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;

        if (update.message) {
          const msg = update.message;
          console.log(`📩 Xabar [${msg.from?.first_name || ""} ID:${msg.from?.id}]:`, msg.text || (msg.contact ? "Contact" : (msg.video ? "Video" : "Media")));
          if (msg.contact) {
            await handleContactReceived(msg.chat.id, msg.contact, msg.from);
          } else if (msg.video) {
            await handleVideoReceived(msg.chat.id, msg.video, msg.from);
          } else if (msg.text) {
            await handleTextMessage(msg.chat.id, msg.text, msg.from);
          }
        } else if (update.callback_query) {
          console.log(`🔘 Callback [${update.callback_query.from?.first_name || ""} ID:${update.callback_query.from?.id}]:`, update.callback_query.data);
          await handleCallbackQuery(update.callback_query);
        }
      }
    }
  } catch (err) {
    console.error("Polling xatoligi:", err.message);
  }

  setTimeout(pollUpdates, 1000);
}

console.log("🚀 Yukla Go Telegram Video Academy Bot ishga tushirildi...");
pollUpdates();
