import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth.ts';
import {
  getCoursesWithUserProgress,
  getCourseLessonsForUser,
  hasUserCourseAccess,
  getUserCourseAccessStatus,
  ensureAcademyAccessLoaded,
} from '../_lib/academyData.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await ensureAcademyAccessLoaded();

  const session = verifySessionToken(req.headers.authorization);
  const userId = session?.userId || (session?.telegramUserId ? String(session.telegramUserId) : 'guest_user');
  const tgId = session?.telegramUserId;
  const customerCode = session?.customerCode;
  const isAdmin = session?.role === 'admin' || session?.role === 'super_admin' || (tgId && [7232597769, 5059829001].includes(tgId));

  const { courseId } = req.query;

  if (courseId) {
    const cId = String(courseId);
    const context = { telegramUserId: tgId, customerCode };
    const hasAccess = isAdmin || hasUserCourseAccess(userId, cId, context);
    const accessStatus = isAdmin ? 'granted' : getUserCourseAccessStatus(userId, cId, context);

    if (!hasAccess) {
      return res.status(200).json({
        hasAccess: false,
        accessStatus,
        lessons: [],
        message: 'Ushbu darslarni ko\'rish uchun administrator ruxsati talab qilinadi.',
      });
    }

    const lessons = getCourseLessonsForUser(userId, cId);
    return res.status(200).json({
      hasAccess: true,
      accessStatus: 'granted',
      lessons,
    });
  }

  const courses = getCoursesWithUserProgress(userId);
  return res.status(200).json(courses);
}
