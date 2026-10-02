/**
 * ==============================================================================
 * YUKLA GO BOT NOTIFICATIONS
 * ==============================================================================
 * Sends real-time notifications to users via Telegram Bot API when parcel
 * statuses change, location change requests are approved, etc.
 */

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://yukla-go.vercel.app';

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

export async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  if (!BOT_TOKEN) {
    console.log(`[BOT DEV NOTIFY] To ${chatId}: ${text}`);
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
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
