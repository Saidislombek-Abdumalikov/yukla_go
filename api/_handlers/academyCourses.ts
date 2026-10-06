import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireUser, sendError } from '../_lib/guard.ts';
import { assertId, getAccessStatus, getLessonsForUser, listCoursesForUser } from '../_lib/academyStore.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireUser(req, res);
  if (!auth) return;

  try {
    const { courseId } = req.query;

    if (courseId) {
      const cId = assertId(courseId, 'courseId');
      const status = auth.isAdmin ? 'granted' : await getAccessStatus(auth.user.id, cId);

      if (status !== 'granted') {
        return res.status(200).json({
          hasAccess: false,
          accessStatus: status,
          lessons: [],
          message: 'Ushbu darslarni ko\'rish uchun administrator ruxsati talab qilinadi.',
        });
      }

      const lessons = await getLessonsForUser(auth.user.id, cId);
      return res.status(200).json({ hasAccess: true, accessStatus: 'granted', lessons });
    }

    return res.status(200).json(await listCoursesForUser(auth.user.id));
  } catch (err) {
    return sendError(res, err);
  }
}
