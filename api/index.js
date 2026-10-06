// api/_lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
var DEFAULT_SUPABASE_URL = "https://dajlwaqoqcnwrrhyvmtw.supabase.co";
var DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhamx3YXFvcWNud3JyaHl2bXR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIwOTk4NSwiZXhwIjoyMTA2Nzg1OTg1fQ.12KfEAK7aU17B2bidfcxeag8P0yLlKJq8QAhoq5mhAs";
var clientInstance = null;
var override = null;
var getSupabase = () => {
  if (override) return override;
  if (clientInstance) return clientInstance;
  const url = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_KEY;
  clientInstance = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return clientInstance;
};

// api/_lib/auth.ts
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
  return "8692358170:AAGvDJ9-5Ckuk8rGZSC6zAhsdM-mqTc0Ewo";
}
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
async function answerTelegramCallbackQuery(callbackQueryId, text) {
  const token = getBotToken();
  if (!token) return false;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text
      })
    });
    return true;
  } catch {
    return false;
  }
}

// api/_lib/botEngine.ts
var MINI_APP_URL2 = process.env.MINI_APP_URL || "https://yuklago.vercel.app";
var userSessions = /* @__PURE__ */ new Map();
function formatPhoneNumber(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) {
    return `+998${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("998")) {
    return `+${digits}`;
  }
  if (digits.length >= 7) {
    return `+${digits}`;
  }
  return raw.trim();
}
async function processTelegramUpdate(update) {
  const message = update.message;
  const callbackQuery = update.callback_query;
  const from = message?.from || callbackQuery?.from;
  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;
  if (!from || !chatId) return false;
  const telegramUserId = from.id;
  const supabase = getSupabase();
  if (callbackQuery) {
    const data = callbackQuery.data;
    await answerTelegramCallbackQuery(callbackQuery.id);
    if (data === "accept_oferta") {
      userSessions.set(telegramUserId, { step: "name" });
      await sendTelegramMessage(
        chatId,
        "\u2705 <b>Oferta shartlari qabul qilindi.</b>\n\nIltimos, to\u2018liq <b>ism va familiyangizni</b> kiriting:\n<i>(Masalan: Saidislom Karimov)</i>",
        { remove_keyboard: true }
      );
      return true;
    }
    return true;
  }
  if (message?.contact) {
    const contact = message.contact;
    const phone = contact.phone_number.startsWith("+") ? contact.phone_number : `+${contact.phone_number}`;
    const session2 = userSessions.get(telegramUserId) || { step: "name" };
    const userName = session2.name || from.first_name || "Hurmatli talaba";
    return await completeRegistration(chatId, telegramUserId, from, userName, phone, supabase);
  }
  const rawText = message?.text?.trim() || "";
  const session = userSessions.get(telegramUserId);
  if (rawText.startsWith("/start")) {
    let existingUser2 = null;
    if (supabase) {
      try {
        const { data } = await supabase.from("users").select("*").eq("telegram_user_id", telegramUserId).maybeSingle();
        existingUser2 = data;
      } catch (err) {
        console.warn("Error checking existing user:", err);
      }
    }
    if (existingUser2 && existingUser2.onboarding_completed) {
      const customerCode = existingUser2.customer_code || "YK-100";
      const userId = existingUser2.id;
      let token = "";
      try {
        token = createSessionToken({
          userId,
          telegramUserId,
          customerCode,
          role: isTelegramAdmin(telegramUserId) ? "admin" : "customer"
        }, "30d");
      } catch {
      }
      const personalLink = `${MINI_APP_URL2}/?code=${encodeURIComponent(customerCode)}&u=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
      await sendTelegramMessage(
        chatId,
        `\u{1F44B} <b>Assalomu alaykum, ${existingUser2.name || from.first_name}!</b>

Siz Yukla Go ta\u2019lim platformasidan muvaffaqiyatli ro\u2018yxatdan o\u2018tgansiz.

\u{1F464} <b>Mijoz kodi:</b> <code>${customerCode}</code>
\u{1F4DE} <b>Telefon:</b> <code>${existingUser2.phone || "Kiritilgan"}</code>

Darslarni davom ettirish uchun quyidagi tugmani bosing:`,
        {
          inline_keyboard: [
            [
              {
                text: "\u{1F680} Darslarni boshlash",
                web_app: { url: personalLink }
              }
            ]
          ]
        }
      );
      return true;
    }
    userSessions.set(telegramUserId, { step: "oferta" });
    const welcomeText = `\u{1F44B} <b>Assalomu alaykum, ${from.first_name || "Hurmatli talaba"}!</b>

Yukla Go yopiq video ta\u2019lim platformasiga xush kelibsiz.

Platformamiz orqali Xitoydan tovar olib kelish, 1688, Taobao va xavfsiz import sirlarini bosqichma-bosqich o\u2018rganasiz.

Kursni boshlashdan oldin ommaviy oferta (foydalanish shartlari) bilan tanishib chiqing:
\u{1F4C4} <a href="https://telegra.ph/Yukla-Go-Ommaviy-Oferta-01-01">Ommaviy Oferta shartlarini o\u2018qish</a>

Davom etish uchun quyidagi tugmani bosing:`;
    await sendTelegramMessage(
      chatId,
      welcomeText,
      {
        inline_keyboard: [
          [
            {
              text: "\u2705 Ofertani qabul qilaman va roziman",
              callback_data: "accept_oferta"
            }
          ]
        ]
      }
    );
    return true;
  }
  if (session && session.step === "name") {
    if (rawText.length < 2) {
      await sendTelegramMessage(
        chatId,
        "\u26A0\uFE0F Iltimos, ism va familiyangizni to\u2018liq kiriting (kamida 2 ta belgi):",
        { remove_keyboard: true }
      );
      return true;
    }
    userSessions.set(telegramUserId, { step: "phone", name: rawText });
    await sendTelegramMessage(
      chatId,
      `\u{1F44D} Rahmat, <b>${rawText}</b>!

Endi <b>telefon raqamingizni</b> yozib yuboring:
<i>(Masalan: +998901234567)</i>`,
      { remove_keyboard: true }
    );
    return true;
  }
  if (session && session.step === "phone") {
    const formattedPhone = formatPhoneNumber(rawText);
    if (formattedPhone.replace(/\D/g, "").length < 7) {
      await sendTelegramMessage(
        chatId,
        "\u26A0\uFE0F Telefon raqam noto\u2018g\u2018ri kiritildi. Iltimos, to\u2018g\u2018ri raqam kiriting:\n<i>(Masalan: +998901234567)</i>",
        { remove_keyboard: true }
      );
      return true;
    }
    const userName = session.name || from.first_name || "Talaba";
    return await completeRegistration(chatId, telegramUserId, from, userName, formattedPhone, supabase);
  }
  let existingUser = null;
  if (supabase) {
    try {
      const { data } = await supabase.from("users").select("*").eq("telegram_user_id", telegramUserId).maybeSingle();
      existingUser = data;
    } catch {
    }
  }
  if (existingUser && existingUser.onboarding_completed) {
    const customerCode = existingUser.customer_code || "YK-100";
    let token = "";
    try {
      token = createSessionToken({
        userId: existingUser.id,
        telegramUserId,
        customerCode,
        role: isTelegramAdmin(telegramUserId) ? "admin" : "customer"
      }, "30d");
    } catch {
    }
    const personalLink = `${MINI_APP_URL2}/?code=${encodeURIComponent(customerCode)}&u=${encodeURIComponent(existingUser.id)}&token=${encodeURIComponent(token)}`;
    await sendTelegramMessage(
      chatId,
      `Siz ro\u2018yxatdan o\u2018tgansiz. Darslarga kirish uchun quyidagi tugmani bosing:`,
      {
        inline_keyboard: [
          [
            {
              text: "\u{1F680} Darslarni boshlash",
              web_app: { url: personalLink }
            }
          ]
        ]
      }
    );
    return true;
  }
  await sendTelegramMessage(
    chatId,
    "Ro\u2018yxatdan o\u2018tish va darslarga kirish uchun /start buyrug\u2018ini bosing.",
    { remove_keyboard: true }
  );
  return true;
}
async function completeRegistration(chatId, telegramUserId, from, userName, phone, supabase) {
  let customerCode = `YK-${Math.floor(100 + Math.random() * 900)}`;
  let userId = `usr_${telegramUserId}`;
  if (supabase) {
    try {
      try {
        const { data: rpcCode } = await supabase.rpc("generate_customer_code");
        if (rpcCode) customerCode = rpcCode;
      } catch {
      }
      const { data: userRow } = await supabase.from("users").upsert(
        {
          telegram_user_id: telegramUserId,
          name: userName.trim(),
          phone: phone.trim(),
          customer_code: customerCode,
          onboarding_completed: true,
          onboarding_step: "completed",
          status: "active",
          phone_verified_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        { onConflict: "telegram_user_id" }
      ).select().single();
      if (userRow) {
        userId = userRow.id;
        if (userRow.customer_code) customerCode = userRow.customer_code;
        try {
          const { data: courses } = await supabase.from("academy_courses").select("id").eq("active", true);
          if (courses && courses.length > 0) {
            for (const c of courses) {
              await supabase.from("academy_access").upsert(
                {
                  user_id: userRow.id,
                  course_id: c.id,
                  status: "granted",
                  granted_at: (/* @__PURE__ */ new Date()).toISOString()
                },
                { onConflict: "user_id,course_id" }
              );
            }
          }
        } catch {
        }
      }
    } catch (err) {
      console.error("Supabase user insert error:", err);
    }
  }
  userSessions.delete(telegramUserId);
  let token = "";
  try {
    token = createSessionToken({
      userId,
      telegramUserId,
      customerCode,
      role: isTelegramAdmin(telegramUserId) ? "admin" : "customer"
    }, "30d");
  } catch {
  }
  const personalLink = `${MINI_APP_URL2}/?code=${encodeURIComponent(customerCode)}&u=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
  const successMessage = `\u{1F389} <b>Tabriklaymiz, ${userName}!</b>

Siz Yukla Go ta\u2019lim platformasidan muvaffaqiyatli ro\u2018yxatdan o\u2018tdingiz.

\u{1F4CB} <b>Sizning ma\u2019lumotlaringiz:</b>
\u2022 <b>Mijoz kodi:</b> <code>${customerCode}</code>
\u2022 <b>Telefon:</b> <code>${phone}</code>

\u{1F447} Shaxsiy o\u2018quv kabinetingizga kirish uchun quyidagi tugmani bosing:`;
  await sendTelegramMessage(
    chatId,
    successMessage,
    {
      inline_keyboard: [
        [
          {
            text: "\u{1F680} Darslarni boshlash",
            web_app: { url: personalLink }
          }
        ]
      ]
    }
  );
  return true;
}

// api/_handlers/botWebhook.ts
var WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "yukla_go_secret_webhook_token_2026";
async function handler(req, res) {
  if (req.method !== "POST") {
    return sendSafeJson(res, 405, { error: "Method not allowed" });
  }
  if (WEBHOOK_SECRET) {
    const receivedSecret = req.headers?.["x-telegram-bot-api-secret-token"];
    if (receivedSecret && receivedSecret !== WEBHOOK_SECRET) {
      return sendSafeJson(res, 401, { error: "Invalid secret token" });
    }
  }
  let update = req.body;
  if (typeof update === "string") {
    try {
      update = JSON.parse(update);
    } catch {
    }
  }
  if (!update && req.on) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const raw = Buffer.concat(buffers).toString("utf-8");
      if (raw) update = JSON.parse(raw);
    } catch {
    }
  }
  if (!update) {
    return sendSafeJson(res, 200, { ok: true });
  }
  try {
    await processTelegramUpdate(update);
  } catch (err) {
    console.error("Webhook update handling error:", err);
  }
  return sendSafeJson(res, 200, { ok: true });
}

// api/_handlers/state.ts
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
async function handler2(req, res) {
  try {
    if (res.setHeader) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    if (req.method === "OPTIONS") {
      return res.status ? res.status(200).end() : res.end();
    }
    const supabase = getSupabase();
    let courses = [];
    let lessons = [];
    let users = [];
    let settings = {
      adminPassword: "admin",
      defaultCompletionPercent: 95,
      autoSaveProgress: true,
      sequentialLessons: true,
      dynamicWatermark: true,
      watermarkFormat: "id-brand"
    };
    if (supabase) {
      try {
        const { data: dbCourses } = await supabase.from("academy_courses").select("*").order("order", { ascending: true });
        if (dbCourses && Array.isArray(dbCourses)) {
          courses = dbCourses.map((c) => ({
            id: c.id,
            title: c.title,
            description: c.description || "",
            lessons: 0,
            users: 0,
            completion: 0,
            status: c.active ? "Faol" : "Qoralama",
            updated: "Bugun",
            tone: c.icon || "blue"
          }));
        }
        const { data: dbLessons } = await supabase.from("academy_lessons").select("*").order("order", { ascending: true });
        if (dbLessons && Array.isArray(dbLessons)) {
          lessons = dbLessons.map((l) => {
            let videoUrl = l.youtube_video_id || "";
            let videoFormat = "auto";
            let thumbnailUrl = "";
            try {
              if (videoUrl.startsWith("{")) {
                const parsed = JSON.parse(videoUrl);
                videoUrl = parsed.url || "";
                videoFormat = parsed.format || "auto";
                thumbnailUrl = parsed.thumb || "";
              }
            } catch {
            }
            if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
              videoUrl = `https://youtu.be/${videoUrl}`;
            }
            return {
              id: l.id,
              courseId: l.course_id,
              title: l.title,
              description: l.description || "",
              duration: formatDuration(l.duration_seconds || 600),
              durationSeconds: l.duration_seconds || 600,
              videoUrl,
              videoFormat,
              status: "Faol",
              thumbnailUrl,
              color: "lesson-blue",
              viewers: 0,
              completion: 0
            };
          });
          courses = courses.map((c) => {
            const count = lessons.filter((l) => String(l.courseId) === String(c.id)).length;
            return { ...c, lessons: count };
          });
        }
        const { data: dbUsers } = await supabase.from("users").select("*").order("created_at", { ascending: false });
        if (dbUsers && Array.isArray(dbUsers)) {
          const { data: dbAccess } = await supabase.from("academy_access").select("*");
          const accessMap = {};
          if (dbAccess) {
            for (const a of dbAccess) {
              if (!accessMap[a.user_id]) accessMap[a.user_id] = {};
              accessMap[a.user_id][a.course_id] = a.status === "granted" ? "Faol" : "To\u2018xtatilgan";
            }
          }
          users = dbUsers.map((u) => {
            const initials = (u.name || "U").trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "YG";
            const userCourseAccess = accessMap[u.id] || {};
            courses.forEach((c) => {
              if (!userCourseAccess[c.id]) {
                userCourseAccess[c.id] = "Faol";
              }
            });
            return {
              id: u.customer_code || u.id,
              name: u.name || "Hurmatli talaba",
              initials,
              phone: u.phone || "",
              access: u.status === "blocked" ? "To\u2018xtatilgan" : "Faol",
              coursesAccess: userCourseAccess,
              progress: 0,
              done: "0 / " + lessons.length,
              activity: "Hozirgina"
            };
          });
        }
      } catch (err) {
        console.error("Supabase state query error:", err);
      }
    }
    const payload = {
      courses,
      lessons,
      users,
      settings,
      progress: {}
    };
    if (typeof res.json === "function") {
      return res.status(200).json(payload);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(payload));
  } catch (error) {
    console.error("State handler critical error:", error);
    if (typeof res.json === "function") {
      return res.status(500).json({ error: error?.message || "Server error" });
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: error?.message || "Server error" }));
  }
}

// api/_handlers/user.ts
async function handler3(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  const { token, code, u } = req.query;
  const supabase = getSupabase();
  if (!token && !code && !u) {
    return res.status(400).json({ error: "Foydalanuvchi parametri kiritilmagan" });
  }
  let customerCode = code ? String(code).trim() : null;
  let userId = u ? String(u).trim() : null;
  if (token) {
    try {
      const decoded = verifySessionToken(String(token));
      if (decoded) {
        customerCode = decoded.customerCode || customerCode;
        userId = decoded.userId || userId;
      }
    } catch {
    }
  }
  if (supabase) {
    try {
      let query = supabase.from("users").select("*");
      if (customerCode) {
        query = query.eq("customer_code", customerCode);
      } else if (userId) {
        query = query.eq("id", userId);
      }
      const { data: userRow } = await query.maybeSingle();
      if (userRow) {
        const initials = (userRow.name || "U").trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "YG";
        const { data: dbAccess } = await supabase.from("academy_access").select("course_id, status").eq("user_id", userRow.id);
        const coursesAccess = {};
        if (dbAccess) {
          for (const a of dbAccess) {
            coursesAccess[a.course_id] = a.status === "granted" ? "Faol" : "To\u2018xtatilgan";
          }
        }
        return res.status(200).json({
          success: true,
          user: {
            id: userRow.customer_code || userRow.id,
            name: userRow.name || "Hurmatli talaba",
            initials,
            phone: userRow.phone || "",
            access: userRow.status === "blocked" ? "To\u2018xtatilgan" : "Faol",
            coursesAccess,
            progress: 0,
            done: "0 / 8",
            activity: "Hozirgina"
          }
        });
      }
    } catch (err) {
      console.error("Supabase user lookup error:", err);
    }
  }
  const fallbackCode = customerCode || "YK-100";
  return res.status(200).json({
    success: true,
    user: {
      id: fallbackCode,
      name: "Hurmatli talaba",
      initials: "YG",
      phone: "",
      access: "Faol",
      coursesAccess: { 1: "Faol", 2: "Faol" },
      progress: 0,
      done: "0 / 8",
      activity: "Hozirgina"
    }
  });
}

// api/_router.ts
function sendSafeJson(res, statusCode, data) {
  try {
    if (typeof res.status === "function") {
      if (typeof res.json === "function") {
        return res.status(statusCode).json(data);
      }
      res.status(statusCode);
      if (res.setHeader) res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(data));
    }
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end(JSON.stringify(data));
  } catch (e) {
    try {
      res.end(JSON.stringify(data));
    } catch {
    }
  }
}
async function handler4(req, res) {
  try {
    const rawUrl = req.url || "";
    const urlObj = new URL(rawUrl, "http://localhost");
    let pathname = urlObj.pathname.replace(/\/$/, "");
    const pathParam = req.query?.__path || urlObj.searchParams.get("__path");
    const normalizedPath = (pathname === "/api" || pathname === "") && pathParam ? `/api/${String(pathParam).replace(/^\//, "").split("?")[0]}` : pathname;
    switch (normalizedPath) {
      case "/api/bot/webhook":
        return await handler(req, res);
      case "/api/state":
      case "/api":
      case "":
        return await handler2(req, res);
      case "/api/user":
        return await handler3(req, res);
      default:
        if (normalizedPath.includes("state") || normalizedPath.includes("academy")) {
          return await handler2(req, res);
        }
        return sendSafeJson(res, 404, {
          error: "API endpoint topilmadi",
          path: normalizedPath
        });
    }
  } catch (err) {
    console.error("Fatal API router error:", err);
    return sendSafeJson(res, 500, { error: err.message || "Server error" });
  }
}
export {
  handler4 as default,
  sendSafeJson
};
