import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateTelegramInitData, createSessionToken, isTelegramAdmin } from '../_lib/auth.ts';
import { getSupabase } from '../_lib/supabase.ts';
import { checkRateLimit, getClientIp } from '../_lib/rateLimiter.ts';

/**
 * POST /api/auth/session
 * The ONLY way in is a Telegram-signed initData string. Whether someone is an
 * admin is decided here, on the server, from their verified Telegram ID
 * (ADMIN_TELEGRAM_IDS) or the user_roles table. There are no passwords or keys.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`auth:${ip}`, 30, 60);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Juda ko\'p so\'rov yuborildi. Birozdan so\'ng qayta urinib ko\'ring.' });
  }

  const { initData, adminKey } = req.body || {};

  if (adminKey) {
    return res.status(401).json({ error: 'Admin kaliti bilan kirish o\'chirilgan. Telegram orqali kiring.' });
  }
  if (!initData || typeof initData !== 'string') {
    return res.status(400).json({ error: 'Telegram initData talab qilinadi' });
  }

  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: validation.error || 'Telegram autentifikatsiyasi tasdiqlanmadi' });
  }

  const tgUser = validation.user;
  const isHardcodedAdmin = isTelegramAdmin(tgUser.id);
  const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Mijoz';
  const supabase = getSupabase();

  // No database: refuse, unless a developer explicitly opted in locally.
  if (!supabase) {
    if (process.env.ALLOW_DEV_AUTH === '1' && process.env.NODE_ENV !== 'production') {
      const role = isHardcodedAdmin ? 'super_admin' : 'customer';
      const code = `YK-${String(tgUser.id).slice(-4)}`;
      const token = createSessionToken({ userId: `usr_dev_${tgUser.id}`, telegramUserId: tgUser.id, customerCode: code, role }, '12h');
      return res.status(200).json({
        token,
        user: { id: `usr_dev_${tgUser.id}`, telegramUserId: tgUser.id, customerCode: code, name: displayName, role },
        devMode: true,
      });
    }
    return res.status(503).json({ error: 'Server sozlanmagan (ma\'lumotlar bazasi yo\'q)' });
  }

  try {
    const cols = 'id, telegram_user_id, customer_code, name, phone, status';
    let { data: dbUser, error: selErr } = await supabase.from('users').select(cols).eq('telegram_user_id', tgUser.id).maybeSingle();
    if (selErr) throw selErr;

    if (!dbUser) {
      const { data: created, error: insErr } = await supabase
        .from('users')
        .upsert(
          {
            telegram_user_id: tgUser.id,
            name: displayName,
            phone: 'pending',
            onboarding_completed: true,
            onboarding_step: 'completed',
          },
          { onConflict: 'telegram_user_id' }
        )
        .select(cols)
        .maybeSingle();
      if (insErr) throw insErr;
      dbUser = created;
    }
    if (!dbUser) throw new Error('User could not be loaded');

    if (dbUser.status === 'blocked' && !isHardcodedAdmin) {
      return res.status(403).json({ error: 'Sizning hisobingiz bloklangan. Administrator bilan bog\'laning.' });
    }

    // Role: hardcoded/ENV admin IDs, otherwise the user_roles table.
    let role: 'customer' | 'admin' | 'super_admin' = isHardcodedAdmin ? 'super_admin' : 'customer';
    if (!isHardcodedAdmin) {
      const { data: roleRow, error: roleErr } = await supabase
        .from('user_roles')
        .select('role')
        .eq('telegram_user_id', tgUser.id)
        .maybeSingle();
      if (roleErr) throw roleErr;
      if (roleRow?.role === 'admin' || roleRow?.role === 'super_admin') role = roleRow.role;
    }

    const token = createSessionToken(
      { userId: dbUser.id, telegramUserId: tgUser.id, customerCode: dbUser.customer_code, role },
      role === 'customer' ? '7d' : '12h'
    );

    return res.status(200).json({
      token,
      user: {
        id: dbUser.id,
        telegramUserId: tgUser.id,
        customerCode: dbUser.customer_code,
        name: dbUser.name || displayName,
        phone: dbUser.phone && dbUser.phone !== 'pending' ? dbUser.phone : '',
        status: dbUser.status || 'active',
        role,
      },
    });
  } catch (err) {
    // Fail closed: never hand out a session we could not back with a real user row.
    console.error('Auth session error:', err);
    return res.status(503).json({ error: 'Kirishda xatolik. Birozdan so\'ng qayta urinib ko\'ring.' });
  }
}
