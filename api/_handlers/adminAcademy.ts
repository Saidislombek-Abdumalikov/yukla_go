import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin, sendError, audit } from '../_lib/guard.ts';
import {
  DEFAULT_COURSE_ID,
  StoreError,
  addCourse,
  addLesson,
  assertId,
  deleteCourse,
  deleteLesson,
  getCourseTitle,
  grantAccess,
  listAccess,
  listAllContent,
  resetProgress,
  resolveUser,
  revokeAccess,
  studentsSummary,
} from '../_lib/academyStore.ts';
import { sendTelegramMessage } from '../_lib/botNotifications.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Admin only. A missing/invalid session is rejected (401), not waved through.
  const session = requireAdmin(req, res);
  if (!session) return;

  try {
    const action = req.query?.action as string | undefined;
    const courseId = assertId(req.query?.courseId || DEFAULT_COURSE_ID, 'courseId');

    // ---------------------------------------------------------------- GET
    if (req.method === 'GET') {
      if (action === 'access') return res.status(200).json(await listAccess(courseId));
      if (action === 'students') return res.status(200).json(await studentsSummary(courseId));
      const content = await listAllContent();
      if (action === 'lessons') {
        return res.status(200).json(content.lessons.filter(l => l.courseId === courseId).sort((a, b) => a.order - b.order));
      }
      return res.status(200).json(content);
    }

    // --------------------------------------------------------------- POST
    if (req.method === 'POST') {
      const body = req.body || {};

      if (body.action === 'grant_access' || body.action === 'revoke_access') {
        const target = body.identifier || body.userId || body.customerCode;
        if (!target) return res.status(400).json({ error: 'Foydalanuvchi identifikatori (ID yoki mijoz kodi) talab qilinadi' });
        const cId = assertId(body.courseId || DEFAULT_COURSE_ID, 'courseId');
        const user = await resolveUser(String(target));
        if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

        if (body.action === 'revoke_access') {
          const item = await revokeAccess(user, cId);
          await audit(session, 'ACADEMY_REVOKE', 'academy_access', user.id, { courseId: cId });
          return res.status(200).json({ success: true, message: 'Ruxsat bekor qilindi', item });
        }

        const item = await grantAccess(user, cId, session.telegramUserId);
        await audit(session, 'ACADEMY_GRANT', 'academy_access', user.id, { courseId: cId });

        const title = (await getCourseTitle(cId)) || 'Video darslar';
        const appUrl = process.env.MINI_APP_URL || 'https://yuklago.vercel.app';
        const academyUrl = appUrl.includes('?') ? `${appUrl}&app=academy` : `${appUrl}?app=academy`;
        await sendTelegramMessage(
          user.telegramUserId,
          `🎉 <b>Tabriklaymiz!</b>\n\nSizga <b>${escapeHtml(title)}</b> kursini tomosha qilish uchun ruxsat berildi!\n\nQuyidagi tugma orqali darslarni hoziroq boshlashingiz mumkin:`,
          { inline_keyboard: [[{ text: '📚 Kurs darslarini boshlash', callback_data: `course_view_${cId}` }]] }
        ).catch(() => {});

        return res.status(200).json({
          success: true,
          message: `${user.name} ga darslarni ko'rish uchun ruxsat berildi!`,
          item,
        });
      }

      if (body.action === 'reset_progress') {
        if (!body.userId) return res.status(400).json({ error: 'userId talab qilinadi' });
        await resetProgress(String(body.userId), body.courseId ? assertId(body.courseId, 'courseId') : undefined);
        await audit(session, 'ACADEMY_RESET', 'academy_progress', String(body.userId), { courseId: body.courseId });
        return res.status(200).json({ success: true, message: 'Talaba progressi muvaffaqiyatli qayta boshlandi' });
      }

      if (body.action === 'add_lesson') {
        const { courseId: cId, title, videoUrl, youtubeUrlOrId, durationSeconds, description } = body;
        const video = videoUrl || youtubeUrlOrId;
        if (!cId || !title || !video) {
          return res.status(400).json({ error: 'courseId, title va video havolasi talab qilinadi' });
        }
        const lesson = await addLesson(String(cId), { title, videoUrl: video, durationSeconds, description });
        await audit(session, 'ACADEMY_ADD_LESSON', 'academy_lessons', lesson.id, { courseId: cId });
        return res.status(201).json({ success: true, message: 'Yangi dars muvaffaqiyatli qo\'shildi', lesson });
      }

      if (body.action === 'create_course') {
        const course = await addCourse({
          title: body.title,
          description: body.description,
          icon: body.icon,
          category: body.category,
        });
        await audit(session, 'ACADEMY_ADD_COURSE', 'academy_courses', course.id);
        return res.status(201).json({ success: true, message: 'Yangi bo\'lim muvaffaqiyatli qo\'shildi', course });
      }

      return res.status(400).json({ error: 'Noma\'lum amal' });
    }

    // ------------------------------------------------------------- DELETE
    if (req.method === 'DELETE') {
      const { lessonId, courseId: delCourseId } = req.query;
      if (delCourseId) {
        const deleted = await deleteCourse(String(delCourseId));
        if (deleted) await audit(session, 'ACADEMY_DELETE_COURSE', 'academy_courses', String(delCourseId));
        return res.status(200).json({ success: deleted, message: deleted ? 'Bo\'lim muvaffaqiyatli o\'chirildi' : 'Bo\'lim topilmadi' });
      }
      if (!lessonId) return res.status(400).json({ error: 'lessonId yoki courseId talab qilinadi' });
      const deleted = await deleteLesson(String(lessonId));
      if (deleted) await audit(session, 'ACADEMY_DELETE_LESSON', 'academy_lessons', String(lessonId));
      return res.status(200).json({ success: deleted, message: deleted ? 'Dars o\'chirildi' : 'Dars topilmadi' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
