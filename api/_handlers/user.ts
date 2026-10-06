import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/supabase.ts';
import { verifySessionToken } from '../_lib/auth.ts';
import { sendSafeJson } from '../_router.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return sendSafeJson(res, 200, { ok: true });
  }

  // Parse query params safely
  const rawUrl = req.url || '';
  const urlObj = new URL(rawUrl, 'http://localhost');
  const query = req.query || {};

  const token = query.token || urlObj.searchParams.get('token');
  const code = query.code || urlObj.searchParams.get('code');
  const u = query.u || urlObj.searchParams.get('u');
  const tg_id = query.tg_id || urlObj.searchParams.get('tg_id');
  const supabase = getSupabase();

  if (!token && !code && !u && !tg_id) {
    return sendSafeJson(res, 400, { error: 'Foydalanuvchi parametri kiritilmagan' });
  }

  let customerCode = code ? String(code).trim() : null;
  let userId = u ? String(u).trim() : null;
  let telegramUserId = tg_id ? Number(tg_id) : null;

  // 1. Verify token if provided
  if (token) {
    try {
      const decoded = verifySessionToken(String(token));
      if (decoded) {
        customerCode = decoded.customerCode || customerCode;
        userId = decoded.userId || userId;
        if (decoded.telegramUserId) telegramUserId = decoded.telegramUserId;
      }
    } catch {}
  }

  if (supabase) {
    try {
      let query = supabase.from('users').select('*');
      if (telegramUserId && !isNaN(telegramUserId)) {
        query = query.eq('telegram_user_id', telegramUserId);
      } else if (customerCode) {
        query = query.eq('customer_code', customerCode);
      } else if (userId) {
        query = query.eq('id', userId);
      }

      const { data: userRow } = await query.maybeSingle();

      if (userRow) {
        if (!userRow.onboarding_completed) {
          return sendSafeJson(res, 403, {
            success: false,
            notRegistered: true,
            error: 'Ro‘yxatdan o‘tish yakunlanmagan. Iltimos, botda ro‘yxatdan o‘tishni yakunlang.',
          });
        }

        const initials = (userRow.name || 'U')
          .trim()
          .split(' ')
          .map((w: string) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'YG';

        // Fetch access
        const { data: dbAccess } = await supabase
          .from('academy_access')
          .select('course_id, status')
          .eq('user_id', userRow.id);

        const coursesAccess: Record<string, 'Faol' | 'To‘xtatilgan'> = {};
        if (dbAccess) {
          for (const a of dbAccess) {
            coursesAccess[String(a.course_id)] = a.status === 'granted' ? 'Faol' : 'To‘xtatilgan';
          }
        }

        return sendSafeJson(res, 200, {
          success: true,
          user: {
            id: userRow.customer_code || userRow.id,
            rawId: userRow.id,
            telegramUserId: userRow.telegram_user_id,
            name: userRow.name || 'Hurmatli talaba',
            initials,
            phone: userRow.phone || '',
            access: userRow.status === 'blocked' ? 'To‘xtatilgan' : 'Faol',
            coursesAccess,
            progress: 0,
            done: '0 / 8',
            activity: 'Hozirgina',
          },
        });
      }
    } catch (err) {
      console.error('Supabase user lookup error:', err);
    }
  }

  return sendSafeJson(res, 404, {
    success: false,
    notRegistered: true,
    error: 'Foydalanuvchi topilmadi. Iltimos, @yuklakargobot orqali ro‘yxatdan o‘ting.',
  });
}
