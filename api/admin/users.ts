import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { getSupabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Ruxsat berilmagan' });
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    if (!supabase) {
      return res.status(200).json([]);
    }

    try {
      const { search } = req.query;
      let query = supabase
        .from('users')
        .select(`
          id,
          telegram_user_id,
          customer_code,
          name,
          phone,
          status,
          onboarding_completed,
          created_at,
          default_branch:default_delivery_branch_id (provider, branch_name, region)
        `)
        .order('created_at', { ascending: false });

      if (search) {
        const s = String(search).trim();
        query = query.or(`customer_code.ilike.%${s}%,name.ilike.%${s}%,phone.ilike.%${s}%`);
      }

      const { data: users, error } = await query;
      if (error) {
        return res.status(500).json({ error: 'Foydalanuvchilarni yuklashda xatolik' });
      }

      return res.status(200).json(users || []);
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  if (req.method === 'PATCH') {
    const { userId, status } = req.body || {};
    if (!userId || !['active', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'userId va status (active/blocked) talab qilinadi' });
    }

    if (!supabase) {
      return res.status(200).json({ success: true });
    }

    try {
      await supabase.from('users').update({ status }).eq('id', userId);

      await supabase.from('admin_audit_logs').insert({
        admin_telegram_id: session.telegramUserId,
        action: `USER_STATUS_${status.toUpperCase()}`,
        entity_type: 'users',
        entity_id: userId,
        details: { status },
      });

      return res.status(200).json({ success: true, message: `Foydalanuvchi holati: ${status}` });
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
