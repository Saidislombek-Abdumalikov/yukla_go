import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import {
  getStudentsProgressSummary,
  resetStudentProgress,
  addLessonToCourse,
  deleteLesson,
  STORED_COURSES,
  STORED_LESSONS,
  addCourse,
  deleteCourse,
  getCourseAccessList,
  grantCourseAccess,
  revokeCourseAccess,
  DEMO_ACADEMY_USERS,
} from '../_lib/academyData';
import { sendTelegramMessage } from '../_lib/botNotifications';
import { getInMemoryBotUsers } from '../_lib/botEngine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifySessionToken(req.headers.authorization);
  if (session && session.role !== 'admin' && session.role !== 'super_admin') {
    return res.status(403).json({ error: 'Ruxsat berilmagan' });
  }

  const { action, courseId = 'course_cargo_101' } = req.query;

  // 1. GET: Students progress list, access permissions, or courses/lessons
  if (req.method === 'GET') {
    if (action === 'access') {
      const accessList = getCourseAccessList(String(courseId));
      return res.status(200).json(accessList);
    }

    if (action === 'students') {
      const allUsers = [...DEMO_ACADEMY_USERS];
      const botUsers = getInMemoryBotUsers();
      for (const bu of botUsers) {
        if (!allUsers.some(u => u.id === bu.id || u.customerCode === bu.customerCode)) {
          allUsers.push({
            id: bu.id,
            name: bu.name,
            customerCode: bu.customerCode,
            telegramUserId: bu.telegramUserId,
          });
        }
      }
      const summary = getStudentsProgressSummary(allUsers, String(courseId));
      return res.status(200).json(summary);
    }

    if (action === 'lessons') {
      const list = STORED_LESSONS.filter(l => l.courseId === String(courseId)).sort((a, b) => a.order - b.order);
      return res.status(200).json(list);
    }

    return res.status(200).json({
      courses: STORED_COURSES,
      lessons: STORED_LESSONS,
    });
  }

  // 2. POST: Add lesson, reset progress, grant or revoke access
  if (req.method === 'POST') {
    const body = req.body || {};

    if (body.action === 'grant_access') {
      const { identifier, userId, customerCode, courseId: targetCourseId = 'course_cargo_101' } = body;
      const target = identifier || userId || customerCode;
      if (!target) return res.status(400).json({ error: 'Foydalanuvchi identifikatori (ID yoki mijoz kodi) talab qilinadi' });

      const result = grantCourseAccess(target, String(targetCourseId));

      // Send bot notification if user has telegramUserId
      if (result.user?.telegramUserId) {
        try {
          const course = STORED_COURSES.find(c => c.id === String(targetCourseId));
          const appUrl = process.env.MINI_APP_URL || 'https://yuklago.vercel.app';
          const academyUrl = appUrl.includes('?') ? `${appUrl}&app=academy` : `${appUrl}?app=academy`;
          await sendTelegramMessage(
            result.user.telegramUserId,
            `🎉 <b>Tabriklaymiz, ${result.user.name}!</b>\n\n` +
            `Sizga <b>${course?.title || 'Video darslar'}</b> kursini tomosha qilish uchun ruxsat berildi!\n\n` +
            `Quyidagi tugma orqali darslarni hoziroq boshlashingiz mumkin:`,
            {
              inline_keyboard: [
                [{ text: '▶️ Darslarni ochish (Mini App)', web_app: { url: academyUrl } }],
              ],
            }
          );
        } catch {}
      }

      return res.status(200).json({
        success: true,
        message: `${result.item?.name || target} ga darslarni ko'rish uchun ruxsat berildi!`,
        item: result.item,
      });
    }

    if (body.action === 'revoke_access') {
      const { identifier, userId, customerCode, courseId: targetCourseId = 'course_cargo_101' } = body;
      const target = identifier || userId || customerCode;
      if (!target) return res.status(400).json({ error: 'Foydalanuvchi identifikatori talab qilinadi' });

      const result = revokeCourseAccess(target, String(targetCourseId));
      return res.status(200).json({
        success: true,
        message: 'Ruxsat bekor qilindi',
        item: result.item,
      });
    }

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

    if (body.action === 'create_course') {
      const { title, description, icon, category } = body;
      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Bo\'lim / kurs nomi talab qilinadi' });
      }

      const created = addCourse({
        title,
        description,
        icon,
        category,
      });

      return res.status(201).json({
        success: true,
        message: 'Yangi bo\'lim muvaffaqiyatli qo\'shildi',
        course: created,
      });
    }

    return res.status(400).json({ error: 'Noma\'lum amal' });
  }

  // 3. DELETE: Remove lesson or course
  if (req.method === 'DELETE') {
    const { lessonId, courseId } = req.query;

    if (courseId) {
      const deleted = deleteCourse(String(courseId));
      return res.status(200).json({
        success: deleted,
        message: deleted ? 'Bo\'lim muvaffaqiyatli o\'chirildi' : 'Bo\'lim topilmadi',
      });
    }

    if (!lessonId) return res.status(400).json({ error: 'lessonId yoki courseId talab qilinadi' });

    const deleted = deleteLesson(String(lessonId));
    return res.status(200).json({
      success: deleted,
      message: deleted ? 'Dars o\'chirildi' : 'Dars topilmadi',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
