import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth.ts';
import { getSupabase } from '../_lib/supabase.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Server sozlanmagan (ma\'lumotlar bazasi yo\'q)' });
  }

  try {
    let query = supabase
      .from('users')
      .select(`
        id,
        telegram_user_id,
        customer_code,
        name,
        phone,
        status,
        default_delivery_branch:delivery_branches (
          id,
          provider,
          branch_name,
          region,
          district,
          address,
          phone
        )
      `);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.userId);
    if (isUuid) {
      query = query.eq('id', session.userId);
    } else if (session.telegramUserId) {
      query = query.eq('telegram_user_id', session.telegramUserId);
    } else {
      query = query.eq('customer_code', session.customerCode);
    }

    const { data: user } = await query.maybeSingle();

    if (!user) {
      return res.status(401).json({ error: 'Foydalanuvchi topilmadi, qayta kiring' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Hisobingiz bloklangan' });
    }

    return res.status(200).json({
      id: user.id,
      telegramUserId: user.telegram_user_id,
      customerCode: user.customer_code,
      name: user.name,
      phone: user.phone,
      status: user.status,
      defaultDeliveryBranch: user.default_delivery_branch,
    });
  } catch (err) {
    console.error('user/me error:', err);
    return res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
}
