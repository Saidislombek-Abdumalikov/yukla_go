import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, sendError } from '../_lib/guard.ts';
import { recordProgress } from '../_lib/academyStore.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  const { lessonId, watchedSeconds, completed = false } = req.body || {};
  if (!lessonId || typeof watchedSeconds !== 'number') {
    return res.status(400).json({ error: 'lessonId va watchedSeconds talab qilinadi' });
  }

  try {
    const result = await recordProgress(auth.user, String(lessonId), watchedSeconds, Boolean(completed), auth.isAdmin);
    return res.status(200).json(result);
  } catch (err) {
    return sendError(res, err);
  }
}
