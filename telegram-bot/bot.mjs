import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env loader
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

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const USER_APP_URL = process.env.USER_APP_URL || process.env.MINI_APP_URL || "https://yuklago.vercel.app";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000/api";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase client
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    console.log("✅ Supabase muvaffaqiyatli ulandi:", SUPABASE_URL);
  } catch (err) {
    console.warn("⚠️ Supabase ulanishida xatolik:", err.message);
  }
}

// Conversation states
const userSessions = new Map(); // chatId -> { step: 'oferta' | 'name' | 'phone', name?: string }

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

// Check existing user in Supabase
async function findExistingUser(telegramId, phone) {
  if (!supabase) return null;
  try {
    if (telegramId) {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_user_id", telegramId)
        .maybeSingle();
      if (data) return data;
    }
    if (phone) {
      const clean = phone.replace(/[\s+]/g, "");
      const { data } = await supabase
        .from("users")
        .select("*")
        .ilike("phone", `%${clean}%`)
        .maybeSingle();
      if (data) return data;
    }
  } catch (err) {
    console.error("Supabase user qidirishda xatolik:", err.message);
  }
  return null;
}

// Register user in Supabase & Sync-server
async function registerUser({ name, phone, telegramId }) {
  let customerCode = `YK-${Math.floor(100 + Math.random() * 900)}`;
  let userRecord = null;

  if (supabase) {
    try {
      // 1. Generate code via RPC or fallback
      try {
        const { data: rpcCode } = await supabase.rpc("generate_customer_code");
        if (rpcCode) customerCode = rpcCode;
      } catch {}

      // 2. Insert into users
      const { data: newUser, error: insertErr } = await supabase
        .from("users")
        .insert({
          telegram_user_id: telegramId,
          customer_code: customerCode,
          name: name.trim(),
          phone: phone.trim(),
          onboarding_completed: true,
          onboarding_step: "completed",
          status: "active",
          phone_verified_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (newUser) {
        userRecord = newUser;

        // 3. Insert oferta acceptance
        try {
          const { data: activeOferta } = await supabase
            .from("oferta_versions")
            .select("id")
            .eq("is_active", true)
            .maybeSingle();
          if (activeOferta) {
            await supabase.from("oferta_acceptances").insert({
              user_id: newUser.id,
              telegram_user_id: telegramId,
              oferta_version_id: activeOferta.id,
            });
          }
        } catch {}

        // 4. Grant access to courses
        try {
          const { data: courses } = await supabase
            .from("academy_courses")
            .select("id")
            .eq("active", true);
          if (courses && courses.length > 0) {
            for (const c of courses) {
              await supabase.from("academy_access").insert({
                user_id: newUser.id,
                course_id: c.id,
                status: "granted",
                granted_at: new Date().toISOString(),
              });
            }
          }
        } catch {}
      } else {
        console.warn("Supabase insert xatosi:", insertErr?.message);
      }
    } catch (err) {
      console.error("Supabase ro‘yxatdan o‘tkazishda xatolik:", err.message);
    }
  }

  // Also sync to local backend
  try {
    await fetch(`${API_BASE_URL}/bot/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, telegramId }),
    });
  } catch {}

  return {
    customerCode,
    userId: userRecord?.id || `usr_${telegramId}`,
    user: userRecord,
  };
}

// /start command handler
async function handleStartCommand(chatId, from) {
  // Check if user already registered
  const existing = await findExistingUser(from.id);
  if (existing && existing.onboarding_completed) {
    const code = existing.customer_code || "YK-100";
    const link = `${USER_APP_URL}/?code=${encodeURIComponent(code)}&u=${encodeURIComponent(existing.id)}`;

    await callTelegram("sendMessage", {
      chat_id: chatId,
      text:
        `Assalomu alaykum, <b>${existing.name || from.first_name}!</b>\n\n` +
        `Siz allaqachon Yukla Go tizimidan ro‘yxatdan o‘tgansiz.\n\n` +
        `👤 Sizning mijoz kodingiz: <code>${code}</code>\n` +
        `📞 Telefon: <code>${existing.phone || "Kiritilgan"}</code>\n\n` +
        `Shaxsiy kabinetingizga kirish uchun quyidagi havola tugmasini bosing:`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🚀 Platformaga kirish", url: link }]],
      },
    });
    return;
  }

  userSessions.set(chatId, { step: "oferta" });

  const text =
    `👋 <b>Assalomu alaykum, ${from.first_name || "Hurmatli talaba"}!</b>\n\n` +
    `Yukla Go video ta’lim platformasiga xush kelibsiz.\n\n` +
    `Platformamiz orqali Xitoydan tovar olib kelish, 1688, Taobao va xavfsiz import sirlarini bosqichma-bosqich o‘rganasiz.\n\n` +
    `Kursni boshlashdan oldin ommaviy oferta (foydalanish shartlari) bilan tanishib chiqing:\n` +
    `📄 <a href="https://telegra.ph/Yukla-Go-Ommaviy-Oferta-01-01">Ommaviy Oferta shartlarini o‘qish</a>\n\n` +
    `Davom etish uchun quyidagi tugmani bosing:`;

  const replyMarkup = {
    inline_keyboard: [
      [{ text: "✅ Ofertani qabul qilaman va roziman", callback_data: "accept_oferta" }],
    ],
  };

  await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
    disable_web_page_preview: false,
  });
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  await callTelegram("answerCallbackQuery", { callback_query_id: callbackQuery.id });

  if (data === "accept_oferta") {
    userSessions.set(chatId, { step: "name" });

    const promptText =
      `✅ <b>Oferta qabul qilindi.</b>\n\n` +
      `Iltimos, to‘liq <b>ism va familiyangizni</b> kiriting:\n` +
      `<i>(Masalan: Saidislom Karimov)</i>`;

    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: promptText,
      parse_mode: "HTML",
    });
  }
}

async function handleTextMessage(chatId, text, from) {
  const session = userSessions.get(chatId) || { step: "start" };

  if (text.startsWith("/start")) {
    return handleStartCommand(chatId, from);
  }

  // Step 1: Receiving Full Name
  if (session.step === "name") {
    const trimmedName = text.trim();
    if (trimmedName.length < 3) {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Iltimos, haqiqiy ism va familiyangizni to‘liq kiriting (kamida 3 ta belgi):",
      });
      return;
    }

    userSessions.set(chatId, { step: "phone", name: trimmedName });

    const phonePrompt =
      `👍 Rahmat, <b>${trimmedName}</b>!\n\n` +
      `Endi <b>telefon raqamingizni</b> kiriting:\n` +
      `<i>(Masalan: +998901234567)</i>`;

    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: phonePrompt,
      parse_mode: "HTML",
    });
    return;
  }

  // Step 2: Receiving Phone Number
  if (session.step === "phone") {
    const cleanPhone = text.trim();
    if (cleanPhone.replace(/\D/g, "").length < 7) {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        text: "⚠️ Iltimos, to‘g‘ri telefon raqam kiriting (masalan: +998901234567):",
      });
      return;
    }

    const userName = session.name || from.first_name || "O‘quvchi";

    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: "⏳ Ma’lumotlar tekshirilmoqda va shaxsiy kabinetingiz tayyorlanmoqda...",
    });

    const reg = await registerUser({
      name: userName,
      phone: cleanPhone,
      telegramId: from.id,
    });

    userSessions.delete(chatId);

    const personalLink = `${USER_APP_URL}/?code=${encodeURIComponent(reg.customerCode)}&u=${encodeURIComponent(reg.userId)}`;

    const successMessage =
      `🎉 <b>Tabriklaymiz, ${userName}!</b>\n\n` +
      `Siz Yukla Go ta’lim platformasidan muvaffaqiyatli ro‘yxatdan o‘tdingiz.\n\n` +
      `📋 <b>Sizning ma’lumotlaringiz:</b>\n` +
      `• <b>Mijoz kodi:</b> <code>${reg.customerCode}</code>\n` +
      `• <b>Telefon:</b> ${cleanPhone}\n\n` +
      `👇 Shaxsiy o‘quv kabinetingizga kirish uchun quyidagi havola tugmasini bosing:`;

    // Pure Link Button Only
    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: "🚀 Platformaga kirish",
            url: personalLink,
          },
        ],
      ],
    };

    await callTelegram("sendMessage", {
      chat_id: chatId,
      text: successMessage,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
    return;
  }

  // Default reply
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "Shaxsiy kabinetingiz havolasini olish yoki ro‘yxatdan o‘tish uchun /start buyrug‘ini yuboring.",
  });
}

// Long-polling worker
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

        if (update.message && update.message.text) {
          await handleTextMessage(
            update.message.chat.id,
            update.message.text,
            update.message.from
          );
        } else if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
        }
      }
    }
  } catch (err) {
    console.error("Polling xatosi:", err.message);
  }

  setTimeout(pollUpdates, 1000);
}

console.log("Yukla Go Telegram Bot xizmati ishga tushirildi...");
pollUpdates();
