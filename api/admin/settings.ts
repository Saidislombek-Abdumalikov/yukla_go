import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { getSupabase } from '../_lib/supabase';
import { SettingsUpdateSchema } from '../_lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Ruxsat berilmagan' });
  }

  const supabase = getSupabase();

  if (req.method === 'GET') {
    if (!supabase) {
      return res.status(200).json({ pricePerKg: 9.5, exchangeRate: 12850, supportUsername: 'nothing_related' });
    }

    try {
      const { data } = await supabase.from('app_settings').select('*');
      let pricePerKg = 9.5;
      let exchangeRate = 12850;
      let supportUsername = 'nothing_related';

      data?.forEach(s => {
        if (s.key === 'cargo_rates') pricePerKg = s.value?.price_per_kg ?? 9.5;
        if (s.key === 'exchange_rate') exchangeRate = s.value?.usd_to_uzs ?? 12850;
        if (s.key === 'support_contact') supportUsername = s.value?.telegram_username ?? 'nothing_related';
      });

      return res.status(200).json({ pricePerKg, exchangeRate, supportUsername });
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  if (req.method === 'PATCH') {
    const parsed = SettingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Noto\'g\'ri qiymatlar' });
    }

    const { pricePerKg, exchangeRate, supportUsername } = parsed.data;

    if (!supabase) {
      return res.status(200).json({ success: true });
    }

    try {
      await Promise.all([
        supabase.from('app_settings').upsert({
          key: 'cargo_rates',
          value: { price_per_kg: pricePerKg, currency: 'USD' },
          updated_at: new Date().toISOString(),
        }),
        supabase.from('app_settings').upsert({
          key: 'exchange_rate',
          value: { usd_to_uzs: exchangeRate },
          updated_at: new Date().toISOString(),
        }),
        supabase.from('app_settings').upsert({
          key: 'support_contact',
          value: { telegram_username: supportUsername },
          updated_at: new Date().toISOString(),
        }),
      ]);

      await supabase.from('admin_audit_logs').insert({
        admin_telegram_id: session.telegramUserId,
        action: 'UPDATE_SETTINGS',
        entity_type: 'app_settings',
        entity_id: 'global',
        details: { pricePerKg, exchangeRate, supportUsername },
      });

      return res.status(200).json({ success: true, message: 'Sozlamalar saqlandi' });
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
