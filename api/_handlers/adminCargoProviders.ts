import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth.ts';
import { getSupabase } from '../_lib/supabase.ts';
import { CargoProviderUpdateSchema } from '../_lib/validation.ts';

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
    const { providerId, setActive, phone, province, city, warehouse_code, address_template, receiver_name } = req.body || {};

    if (!supabase) {
      return res.status(200).json({ success: true, message: 'Ombor sozlamalari yangilandi' });
    }

    try {
      if (setActive !== undefined) {
        if (setActive) {
          await supabase.from('cargo_providers').update({ active: false }).neq('id', providerId);
          await supabase.from('cargo_providers').update({ active: true }).eq('id', providerId);
        } else {
          await supabase.from('cargo_providers').update({ active: false }).eq('id', providerId);
        }
      }

      // Allow updating address fields
      const updateData: Record<string, any> = {};
      if (phone !== undefined) updateData.phone = phone;
      if (province !== undefined) updateData.province = province;
      if (city !== undefined) updateData.city = city;
      if (warehouse_code !== undefined) updateData.warehouse_code = warehouse_code;
      if (address_template !== undefined) updateData.address_template = address_template;
      if (receiver_name !== undefined) updateData.receiver_name = receiver_name;

      if (Object.keys(updateData).length > 0) {
        const targetId = providerId || (await supabase.from('cargo_providers').select('id').eq('active', true).single()).data?.id;
        if (targetId) {
          await supabase.from('cargo_providers').update(updateData).eq('id', targetId);
        }
      }

      await supabase.from('admin_audit_logs').insert({
        admin_telegram_id: session.telegramUserId,
        action: 'UPDATE_CARGO_PROVIDER',
        entity_type: 'cargo_providers',
        entity_id: providerId || 'active',
        details: { setActive, ...updateData },
      });

      return res.status(200).json({ success: true, message: 'Karqo ombori sozlamalari yangilandi' });
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
