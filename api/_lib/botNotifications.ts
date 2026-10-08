/**
 * ==============================================================================
 * YUKLA GO BOT NOTIFICATIONS
 * ==============================================================================
 * Sends real-time notifications to users via Telegram Bot API when parcel
 * statuses change, location change requests are approved, etc.
 */

import fs from 'fs';
import path from 'path';

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://yuklago.vercel.app';

export function getBotToken(): string {
  if (process.env.BOT_TOKEN) return process.env.BOT_TOKEN;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/^BOT_TOKEN=(.+)$/m);
      if (match && match[1]) {
        const val = match[1].trim();
        process.env.BOT_TOKEN = val;
        return val;
      }
    }
  } catch {}
  return 'REMOVED_ROTATE_BOT_TOKEN';
}

export const STATUS_MESSAGES: Record<string, { title: string; desc: string }> = {
  added: {
    title: '📝 Yangi trek kiritildi',
    desc: 'Trek kodi tizimga kiritildi va Xitoy omborida kutilmoqda.',
  },
  china_warehouse: {
    title: '🇨🇳 Xitoy omboriga qabul qilindi',
    desc: 'Yukingiz Xitoy omboriga muvaffaqiyatli yetib keldi va jo\'natishga tayyorlanmoqda.',
  },
  in_transit: {
    title: '✈️ Yukingiz yo\'lga chiqdi',
    desc: 'Yukingiz samolyotda O\'zbekistonga parvoz qilmoqda.',
  },
  uzbekistan: {
    title: '🇺🇿 Yukingiz O\'zbekistonga yetib keldi',
    desc: 'Yukingiz Toshkentdagi saralash markaziga yetib keldi va belgilangan filialga yuborilmoqda.',
  },
  delivered: {
    title: '🎉 Yukingiz yetkazildi',
    desc: 'Yukingiz belgilangan filialda qabul qilindi va yetkazib berildi.',
  },
};

export async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any): Promise<boolean> {
  const token = getBotToken();
  if (!token) {
    console.log(`[BOT DEV NOTIFY] No BOT_TOKEN. Message to ${chatId}: ${text}`);
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`Telegram API error for chat ${chatId}:`, json);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
    return false;
  }
}

export async function answerTelegramCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
  const token = getBotToken();
  if (!token) return false;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function notifyParcelStatusUpdate(
  telegramUserId: number,
  trackingNumber: string,
  newStatus: string,
  weightKg?: number,
  amount?: number
) {
  const statusInfo = STATUS_MESSAGES[newStatus] || {
    title: '📦 Yuk holati yangilandi',
    desc: `Yangi holat: ${newStatus}`,
  };

  let details = '';
  if (weightKg && weightKg > 0) {
    details += `\n⚖️ Vazni: <b>${weightKg} kg</b>`;
  }
  if (amount && amount > 0) {
    details += `\n💵 To'lov summasi: <b>$${amount.toFixed(2)}</b>`;
  }

  const message =
    `<b>${statusInfo.title}</b>\n\n` +
    `📦 Trek raqami: <code>${trackingNumber}</code>\n` +
    `ℹ️ ${statusInfo.desc}${details}\n\n` +
    `Batafsil ma'lumotni ilovada ko'rishingiz mumkin:`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📦 Yukla Go ilovasini ochish', web_app: { url: MINI_APP_URL } }],
    ],
  };

  return sendTelegramMessage(telegramUserId, message, keyboard);
}
