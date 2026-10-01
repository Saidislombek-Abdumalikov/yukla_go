import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { getSupabase } from '../_lib/supabase';
import { CargoProviderUpdateSchema } from '../_lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Ruxsat berilmagan' });
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    if (!supabase) {
      return res.status(200).json([
        {
          id: 'cp_1',
          internal_name: 'Main China Air Hub',
          receiver_name: 'Yukla Go',
          phone: '13335957161',
          province: 'Zhejiang',
          city: 'Jinhua/Yiwu',
          full_address: '077库房/70099号',
          warehouse_code: '077库房/70099号',
          address_template: '{warehouse_code} {customer_id}',
          active: true,
        },
      ]);
    }

    try {
      const { data, error } = await supabase
        .from('cargo_providers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: 'Yuklashda xatolik' });
      return res.status(200).json(data || []);
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  if (req.method === 'PATCH') {
    const { providerId, setActive } = req.body || {};
    if (!providerId || setActive === undefined) {
      return res.status(400).json({ error: 'providerId va setActive talab qilinadi' });
    }

    if (!supabase) {
      return res.status(200).json({ success: true });
    }

    try {
      if (setActive) {
        // First set all others inactive to enforce single active provider rule
        await supabase.from('cargo_providers').update({ active: false }).neq('id', providerId);
        await supabase.from('cargo_providers').update({ active: true }).eq('id', providerId);
      } else {
        await supabase.from('cargo_providers').update({ active: false }).eq('id', providerId);
      }

      await supabase.from('admin_audit_logs').insert({
        admin_telegram_id: session.telegramUserId,
        action: 'SWITCH_CARGO_PROVIDER',
        entity_type: 'cargo_providers',
        entity_id: providerId,
        details: { active: setActive },
      });

      return res.status(200).json({ success: true, message: 'Karqo provayderi yangilandi' });
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
