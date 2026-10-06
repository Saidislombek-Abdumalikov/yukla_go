import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, sendError } from '../_lib/guard.ts';
import { assertId, requestAccess, getCourseTitle } from '../_lib/academyStore.ts';
import { ADMIN_TELEGRAM_IDS } from '../_lib/auth.ts';
import { sendTelegramMessage } from '../_lib/botNotifications.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  const { courseId } = req.body || {};
  if (!courseId) {
    return res.status(400).json({ error: 'courseId talab qilinadi' });
  }

  try {
    // Identity ALWAYS comes from the verified session, never from the request body.
    const cId = assertId(courseId, 'courseId');
    const item = await requestAccess(auth.user, cId);

    if (item.status === 'pending') {
      const title = (await getCourseTitle(cId)) || cId;
      for (const adminId of ADMIN_TELEGRAM_IDS) {
        await sendTelegramMessage(
          adminId,
          `🔔 <b>Yangi darslik so'rovi!</b>\n\n` +
            `👤 Talaba: <b>${escapeHtml(item.name)}</b> (<code>${escapeHtml(item.customerCode)}</code>)\n` +
            `📚 Kurs: <b>${escapeHtml(title)}</b>\n\n` +
            `<i>Admin panel orqali "Ruxsat berish" tugmasini bosib tasdiqlashingiz mumkin.</i>`
        ).catch(() => {});
      }
    }

    return res.status(200).json({
      success: true,
      message: item.status === 'granted'
        ? 'Sizda bu kursga ruxsat allaqachon bor.'
        : 'So\'rovingiz qabul qilindi. Administrator tez orada tasdiqlaydi.',
      item,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
