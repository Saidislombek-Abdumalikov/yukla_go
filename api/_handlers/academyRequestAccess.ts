import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth.ts';
import { requestCourseAccess, INITIAL_COURSES } from '../_lib/academyData.ts';
import { sendTelegramMessage } from '../_lib/botNotifications.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySessionToken(req.headers.authorization);
  const { courseId, name, customerCode, telegramUserId } = req.body || {};
  const userId = session?.userId || (session?.telegramUserId ? String(session.telegramUserId) : (telegramUserId ? String(telegramUserId) : 'guest_user'));
  const effectiveCode = session?.customerCode || customerCode;
  const effectiveTgId = session?.telegramUserId || (telegramUserId ? Number(telegramUserId) : undefined);

  if (!courseId) {
    return res.status(400).json({ error: 'courseId talab qilinadi' });
  }

  const item = await requestCourseAccess(userId, String(courseId), {
    name,
    customerCode: effectiveCode,
    telegramUserId: effectiveTgId,
  });

  const course = INITIAL_COURSES.find(c => c.id === courseId);
  const courseTitle = course?.title || courseId;

  // Notify verified admins
  try {
    const adminIds = [7232597769, 5059829001];
    for (const admId of adminIds) {
      await sendTelegramMessage(
        admId,
        `🔔 <b>Yangi darslik so'rovi!</b>\n\n` +
        `👤 Talaba: <b>${item.name}</b> (<code>${item.customerCode}</code>)\n` +
        `📚 Kurs: <b>${courseTitle}</b>\n\n` +
        `<i>Admin panel orqali "Ruxsat berish" tugmasini bosib tasdiqlashingiz mumkin.</i>`
      ).catch(() => {});
    }
  } catch {}

  return res.status(200).json({
    success: true,
    message: 'So\'rovingiz qabul qilindi. Administrator tez orada tasdiqlaydi.',
    item,
  });
}
