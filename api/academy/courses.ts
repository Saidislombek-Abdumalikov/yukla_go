import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import {
  getCoursesWithUserProgress,
  getCourseLessonsForUser,
  hasUserCourseAccess,
  getUserCourseAccessStatus,
} from '../_lib/academyData';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySessionToken(req.headers.authorization);
  const userId = session?.userId || (session?.telegramUserId ? String(session.telegramUserId) : 'guest_user');
  const isAdmin = session?.role === 'admin' || session?.role === 'super_admin' || (session?.telegramUserId && [7232597769, 5059829001].includes(session.telegramUserId));

  const { courseId } = req.query;

  if (courseId) {
    const cId = String(courseId);
    const hasAccess = isAdmin || hasUserCourseAccess(userId, cId);
    const accessStatus = isAdmin ? 'granted' : getUserCourseAccessStatus(userId, cId);

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
