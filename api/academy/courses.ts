import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { getCoursesWithUserProgress, getCourseLessonsForUser } from '../_lib/academyData';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySessionToken(req.headers.authorization);
  const userId = session?.userId || 'usr_dev_100';

  const { courseId } = req.query;

  if (courseId) {
    const lessons = getCourseLessonsForUser(userId, String(courseId));
    return res.status(200).json(lessons);
  }

  const courses = getCoursesWithUserProgress(userId);
  return res.status(200).json(courses);
}
