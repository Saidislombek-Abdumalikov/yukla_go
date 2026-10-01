import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, region } = req.query;
  const supabase = getSupabase();

  if (!supabase) {
    // Development fallback branches
    const devBranches = [
      { id: 'b_1', provider: 'BTS', branch_name: 'BTS Chorsu', region: 'Namangan', address: 'Namangan sh., Chorsu dahasi, 12' },
      { id: 'b_2', provider: 'BTS', branch_name: 'BTS Chilonzor', region: 'Toshkent', address: 'Chilonzor 9-mavze, Qatortol 1' },
      { id: 'b_3', provider: 'EMU', branch_name: 'EMU Yunusobod', region: 'Toshkent', address: 'Yunusobod 4-mavze' },
      { id: 'b_4', provider: 'EMU', branch_name: 'EMU Chortoq', region: 'Namangan', address: 'Mustaqillik ko\'chasi 10' },
      { id: 'b_5', provider: 'UZPOST', branch_name: 'Bosh Pochtampt', region: 'Toshkent', address: 'Shahrisabz ko\'chasi 7' },
    ];
    let filtered = devBranches;
    if (provider) filtered = filtered.filter(b => b.provider === String(provider).toUpperCase());
    if (region) filtered = filtered.filter(b => b.region.toLowerCase() === String(region).toLowerCase());
    return res.status(200).json(filtered);
  }

  try {
    let query = supabase
      .from('delivery_branches')
      .select('id, provider, provider_branch_code, region, district, city, branch_name, address, phone')
      .eq('active', true)
      .order('region', { ascending: true })
      .order('branch_name', { ascending: true });

    if (provider) {
      query = query.eq('provider', String(provider).toUpperCase());
    }
    if (region) {
      query = query.eq('region', String(region));
    }

    const { data: branches, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Filiallarni yuklashda xatolik' });
    }

    return res.status(200).json(branches || []);
  } catch (err) {
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
}
