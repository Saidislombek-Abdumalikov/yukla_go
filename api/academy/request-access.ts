import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { requestCourseAccess, INITIAL_COURSES } from '../_lib/academyData';
import { sendTelegramMessage } from '../_lib/botNotifications';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySessionToken(req.headers.authorization);
  const { courseId, name, customerCode, telegramUserId } = req.body || {};
  const userId = session?.userId || (session?.telegramUserId ? String(session.telegramUserId) : (telegramUserId ? String(telegramUserId) : 'guest_user'));
  if (!courseId) {
    return res.status(400).json({ error: 'courseId talab qilinadi' });
  }

  const item = requestCourseAccess(userId, String(courseId), {
    name,
    customerCode,
    telegramUserId: telegramUserId ? Number(telegramUserId) : undefined,
  });

  const course = INITIAL_COURSES.find(c => c.id === courseId);
  const courseTitle = course?.title || courseId;

  // Notify admin if configured (e.g. admin chat ID or handle)
  try {
    // If admin chat id is available via env or send notification
    const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
    if (adminChatId) {
      await sendTelegramMessage(
        adminChatId,
        `🔔 <b>Yangi darslik so'rovi!</b>\n\n` +
        `👤 Talaba: <b>${item.name}</b> (<code>${item.customerCode}</code>)\n` +
        `📚 Kurs: <b>${courseTitle}</b>\n\n` +
        `<i>Admin panel orqali ruxsat berishingiz mumkin.</i>`
      );
    }
  } catch {}

  return res.status(200).json({
    success: true,
    message: 'So\'rovingiz qabul qilindi. Administrator tez orada tasdiqlaydi.',
    item,
  });
}
