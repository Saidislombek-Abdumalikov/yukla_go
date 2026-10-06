import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/supabase.ts';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();

  let courses: any[] = [];
  let lessons: any[] = [];
  let users: any[] = [];
  let settings = {
    adminPassword: 'admin',
    defaultCompletionPercent: 95,
    autoSaveProgress: true,
    sequentialLessons: true,
    dynamicWatermark: true,
    watermarkFormat: 'id-brand',
  };

  if (supabase) {
    try {
      // 1. Fetch courses
      const { data: dbCourses } = await supabase
        .from('academy_courses')
        .select('*')
        .order('order', { ascending: true });

      if (dbCourses) {
        courses = dbCourses.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description || '',
          lessons: 0,
          users: 0,
          completion: 0,
          status: c.active ? 'Faol' : 'Qoralama',
          updated: 'Bugun',
          tone: c.icon || 'blue',
        }));
      }

      // 2. Fetch lessons
      const { data: dbLessons } = await supabase
        .from('academy_lessons')
        .select('*')
        .order('order', { ascending: true });

      if (dbLessons) {
        lessons = dbLessons.map((l) => {
          let videoUrl = l.youtube_video_id || '';
          let videoFormat = 'auto';
          let thumbnailUrl = '';

          try {
            if (videoUrl.startsWith('{')) {
              const parsed = JSON.parse(videoUrl);
              videoUrl = parsed.url || '';
              videoFormat = parsed.format || 'auto';
              thumbnailUrl = parsed.thumb || '';
            }
          } catch {}

          // If raw YouTube ID, construct full URL
          if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
            videoUrl = `https://youtu.be/${videoUrl}`;
          }

          return {
            id: l.id,
            courseId: l.course_id,
            title: l.title,
            description: l.description || '',
            duration: formatDuration(l.duration_seconds || 600),
            durationSeconds: l.duration_seconds || 600,
            videoUrl,
            videoFormat,
            status: 'Faol',
            thumbnailUrl,
            color: 'lesson-blue',
            viewers: 0,
            completion: 0,
          };
        });

        // Update lesson count on courses
        courses = courses.map((c) => {
          const count = lessons.filter((l) => String(l.courseId) === String(c.id)).length;
          return { ...c, lessons: count };
        });
      }

      // 3. Fetch registered users
      const { data: dbUsers } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbUsers) {
        // Also fetch course access
        const { data: dbAccess } = await supabase.from('academy_access').select('*');
        const accessMap: Record<string, Record<string, 'Faol' | 'To‘xtatilgan'>> = {};

        if (dbAccess) {
          for (const a of dbAccess) {
            if (!accessMap[a.user_id]) accessMap[a.user_id] = {};
            accessMap[a.user_id][a.course_id] = a.status === 'granted' ? 'Faol' : 'To‘xtatilgan';
          }
        }

        users = dbUsers.map((u) => {
          const initials = (u.name || 'U')
            .trim()
            .split(' ')
            .map((w: string) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'YG';

          // Default grant all courses if no specific record
          const userCourseAccess: Record<string, 'Faol' | 'To‘xtatilgan'> = accessMap[u.id] || {};
          courses.forEach((c) => {
            if (!userCourseAccess[c.id]) {
              userCourseAccess[c.id] = 'Faol';
            }
          });

          return {
            id: u.customer_code || u.id,
            name: u.name || 'Hurmatli talaba',
            initials,
            phone: u.phone || '',
            access: u.status === 'blocked' ? 'To‘xtatilgan' : 'Faol',
            coursesAccess: userCourseAccess,
            progress: 0,
            done: '0 / ' + lessons.length,
            activity: 'Hozirgina',
          };
        });
      }
    } catch (err) {
      console.error('Error fetching Supabase state:', err);
    }
  }

  return res.status(200).json({
    courses,
    lessons,
    users,
    settings,
    progress: {},
  });
}
