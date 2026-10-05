import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateTelegramInitData, createSessionToken, isTelegramAdmin } from '../_lib/auth';
import { getSupabase } from '../_lib/supabase';
import { checkRateLimit, getClientIp } from '../_lib/rateLimiter';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`auth:${ip}`, 15, 60);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Juda ko\'p so\'rov yuborildi. Birozdan so\'ng qayta urinib ko\'ring.' });
  }

  const { initData } = req.body || {};
  if (!initData) {
    return res.status(400).json({ error: 'Telegram initData talab qilinadi' });
  }

  // 1. Verify Telegram signature
  const validation = validateTelegramInitData(initData);
  if (!validation.valid || !validation.user) {
    return res.status(401).json({ error: validation.error || 'Telegram autentifikatsiyasi tasdiqlanmadi' });
  }

  const tgUser = validation.user;
  const supabase = getSupabase();

  if (!supabase) {
    // Development mode fallback when Supabase keys are not yet configured in local environment
    const sessionToken = createSessionToken({
      userId: `usr_dev_${tgUser.id}`,
      telegramUserId: tgUser.id,
      customerCode: 'YK-100',
      role: 'customer',
    });
    return res.status(200).json({
      token: sessionToken,
      user: {
        telegramUserId: tgUser.id,
        customerCode: 'YK-100',
        name: tgUser.first_name,
        role: 'customer',
      },
      devMode: true,
    });
  }

  try {
    // 2. Fetch user by telegram_user_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, telegram_user_id, customer_code, name, status, onboarding_completed')
      .eq('telegram_user_id', tgUser.id)
      .single();

    if (userError || !user) {
      return res.status(403).json({
        error: 'Foydalanuvchi topilmadi. Iltimos, Telegram botimizda ro\'yxatdan o\'ting.',
        needsOnboarding: true,
      });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Sizning hisobingiz bloklangan. Administrator bilan bog\'laning.' });
    }

    if (!user.onboarding_completed) {
      return res.status(403).json({
        error: 'Ro\'yxatdan o\'tish yakunlanmagan. Iltimos, botda ro\'yxatdan o\'tishni yakunlang.',
        needsOnboarding: true,
      });
    }

    // 3. Determine role
    let role: 'customer' | 'admin' | 'super_admin' = 'customer';
    if (isTelegramAdmin(tgUser.id)) {
      role = 'super_admin';
    } else {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('telegram_user_id', tgUser.id)
        .single();

      if (roleData?.role) {
        role = roleData.role as 'admin' | 'super_admin';
      }
    }

    // 4. Issue short-lived session token
    const token = createSessionToken({
      userId: user.id,
      telegramUserId: user.telegram_user_id,
      customerCode: user.customer_code,
      role,
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        telegramUserId: user.telegram_user_id,
        customerCode: user.customer_code,
        name: user.name,
        role,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Tizimda xatolik yuz berdi. Qayta urinib ko\'ring.' });
  }
}
