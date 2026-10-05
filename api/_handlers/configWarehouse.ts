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
      receiver: `Yukla Go (${session.customerCode})`,
      phone: '13335957161',
      region: '浙江省金华市义乌市',
      address: `077库房/70099号 ${session.customerCode}`,
      customerCode: session.customerCode,
    });
  }

  try {
    const { data: provider, error } = await supabase
      .from('cargo_providers')
      .select('phone, province, city, district, full_address, warehouse_code, address_template')
      .eq('active', true)
      .single();

    if (error || !provider) {
      return res.status(500).json({ error: 'Faol ombor sozlamalari topilmadi' });
    }

    // Build customer-safe address without leaking internal provider name
    const region = `${provider.province} ${provider.city}${provider.district ? ' ' + provider.district : ''}`;
    const address = provider.address_template
      .replace('{warehouse_code}', provider.warehouse_code)
      .replace('{customer_id}', session.customerCode);

    return res.status(200).json({
      receiver: `Yukla Go (${session.customerCode})`,
      phone: provider.phone,
      region,
      address,
      customerCode: session.customerCode,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
}
