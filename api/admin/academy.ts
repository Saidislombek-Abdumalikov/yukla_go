import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import {
  getStudentsProgressSummary,
  resetStudentProgress,
  addLessonToCourse,
  deleteLesson,
  INITIAL_COURSES,
  STORED_LESSONS,
} from '../_lib/academyData';

const DEMO_STUDENTS = [
  { id: 'usr_dev_100', name: 'Saidislom', customerCode: 'YK-100' },
  { id: 'usr_dev_101', name: 'Bobur Mirzo', customerCode: 'YK-101' },
  { id: 'usr_dev_102', name: 'Madina Alimova', customerCode: 'YK-102' },
  { id: 'usr_dev_103', name: 'Jasur Bek', customerCode: 'YK-103' },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifySessionToken(req.headers.authorization);
  if (session && session.role !== 'admin' && session.role !== 'super_admin') {
    return res.status(403).json({ error: 'Ruxsat berilmagan' });
  }

  const { action, courseId = 'course_cargo_101' } = req.query;

  // 1. GET: Students progress list or courses/lessons
  if (req.method === 'GET') {
    if (action === 'students') {
      const summary = getStudentsProgressSummary(DEMO_STUDENTS, String(courseId));
      return res.status(200).json(summary);
    }

    if (action === 'lessons') {
      const list = STORED_LESSONS.filter(l => l.courseId === String(courseId)).sort((a, b) => a.order - b.order);
      return res.status(200).json(list);
    }

    return res.status(200).json({
      courses: INITIAL_COURSES,
      lessons: STORED_LESSONS,
    });
  }

  // 2. POST: Add lesson or reset student progress
  if (req.method === 'POST') {
    const body = req.body || {};

    if (body.action === 'reset_progress') {
      const { userId, courseId: targetCourseId } = body;
      if (!userId) return res.status(400).json({ error: 'userId talab qilinadi' });
      resetStudentProgress(userId, targetCourseId);
      return res.status(200).json({
        success: true,
        message: 'Talaba progressi muvaffaqiyatli qayta boshlandi',
      });
    }

    if (body.action === 'add_lesson') {
      const { courseId: cId, title, youtubeUrlOrId, durationSeconds, description } = body;
      if (!cId || !title || !youtubeUrlOrId) {
        return res.status(400).json({ error: 'courseId, title va youtubeUrlOrId talab qilinadi' });
      }

      const created = addLessonToCourse(cId, {
        title,
        youtubeUrlOrId,
        durationSeconds: Number(durationSeconds) || 360,
        description,
      });

      return res.status(201).json({
        success: true,
        message: 'Yangi dars muvaffaqiyatli qo\'shildi',
        lesson: created,
      });
    }

    return res.status(400).json({ error: 'Noma\'lum amal' });
  }

  // 3. DELETE: Remove lesson
  if (req.method === 'DELETE') {
    const { lessonId } = req.query;
    if (!lessonId) return res.status(400).json({ error: 'lessonId talab qilinadi' });

    const deleted = deleteLesson(String(lessonId));
    return res.status(200).json({
      success: deleted,
      message: deleted ? 'Dars o\'chirildi' : 'Dars topilmadi',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
