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
    // Development fallback
    return res.status(200).json({
      id: session.userId,
      telegramUserId: session.telegramUserId,
      customerCode: session.customerCode,
      name: 'Saidislom',
      phone: '+998 90 123 45 67',
      status: 'active',
      defaultDeliveryBranch: {
        provider: 'BTS',
        branchName: 'BTS Chorsu',
        region: 'Namangan',
        address: 'Namangan sh., Chorsu dahasi, 12-uy',
      },
    });
  }

  try {
    const { data: user, error } = await supabase
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
      `)
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
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
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
}
