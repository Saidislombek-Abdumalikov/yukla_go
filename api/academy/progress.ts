import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { recordUserLessonProgress } from '../_lib/academyData';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySessionToken(req.headers.authorization);
  const userId = session?.userId || (session?.telegramUserId ? String(session.telegramUserId) : 'guest_user');

  const { lessonId, watchedSeconds, completed = false } = req.body || {};

  if (!lessonId || typeof watchedSeconds !== 'number') {
    return res.status(400).json({ error: 'lessonId va watchedSeconds talab qilinadi' });
  }

  try {
    const result = recordUserLessonProgress(
      userId,
      String(lessonId),
      Number(watchedSeconds),
      Boolean(completed)
    );
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Xatolik yuz berdi' });
  }
}
