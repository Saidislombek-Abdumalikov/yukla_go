import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/supabase';
import { getBranches } from '../_lib/branchesData';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, region } = req.query;
  const supabase = getSupabase();

  if (!supabase) {
    const list = getBranches(
      provider ? String(provider) : undefined,
      region ? String(region) : undefined
    ).map(b => ({
      ...b,
      branch_name: b.branchName,
    }));
    return res.status(200).json(list);
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
