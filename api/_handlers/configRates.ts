import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/supabase.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      pricePerKg: 9.5,
      exchangeRate: 12850,
    });
  }

  try {
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value');

    let pricePerKg = 9.5;
    let exchangeRate = 12850;

    settings?.forEach(item => {
      if (item.key === 'cargo_rates') {
        pricePerKg = item.value?.price_per_kg ?? 9.5;
      }
      if (item.key === 'exchange_rate') {
        exchangeRate = item.value?.usd_to_uzs ?? 12850;
      }
    });

    return res.status(200).json({
      pricePerKg,
      exchangeRate,
    });
  } catch (err) {
    return res.status(200).json({
      pricePerKg: 9.5,
      exchangeRate: 12850,
    });
  }
}
