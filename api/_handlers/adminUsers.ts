import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken, ADMIN_TELEGRAM_IDS } from '../_lib/auth.ts';
import { getSupabase } from '../_lib/supabase.ts';
import { wipeBotUser } from '../_lib/botEngine.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Ruxsat berilmagan' });
  }

  const supabase = getSupabase();

  // 1. GET: List users with optional search
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

      // Attach roles from user_roles
      const { data: allRoles } = await supabase.from('user_roles').select('telegram_user_id, role');
      const roleMap = new Map((allRoles || []).map(r => [r.telegram_user_id, r.role]));

      const enriched = (users || []).map(u => ({
        ...u,
        role: roleMap.get(u.telegram_user_id) || (ADMIN_TELEGRAM_IDS.includes(Number(u.telegram_user_id)) ? 'super_admin' : 'customer'),
      }));

      return res.status(200).json(enriched);
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  // 2. PATCH: Toggle user status (active / blocked) or update role (admin / customer)
  if (req.method === 'PATCH') {
    const { userId, status, role, telegramUserId } = req.body || {};
    if (!userId && !telegramUserId) {
      return res.status(400).json({ error: 'userId yoki telegramUserId talab qilinadi' });
    }

    if (!supabase) {
      return res.status(200).json({ success: true });
    }

    try {
      let tgId = telegramUserId;
      if (!tgId && userId) {
        const { data: u } = await supabase.from('users').select('telegram_user_id').eq('id', userId).maybeSingle();
        tgId = u?.telegram_user_id;
      }

      // Update status if passed
      if (status && ['active', 'blocked'].includes(status)) {
        await supabase.from('users').update({ status }).eq('id', userId);
        await supabase.from('admin_audit_logs').insert({
          admin_telegram_id: session.telegramUserId,
          action: `USER_STATUS_${status.toUpperCase()}`,
          entity_type: 'users',
          entity_id: userId,
          details: { status },
        });
      }

      // Update role if passed
      if (role && ['admin', 'super_admin', 'customer', 'operator'].includes(role) && tgId) {
        if (role === 'customer') {
          await supabase.from('user_roles').delete().eq('telegram_user_id', tgId);
        } else {
          await supabase.from('user_roles').upsert({
            telegram_user_id: tgId,
            role,
          }, { onConflict: 'telegram_user_id' });
        }
        await supabase.from('admin_audit_logs').insert({
          admin_telegram_id: session.telegramUserId,
          action: `USER_ROLE_${role.toUpperCase()}`,
          entity_type: 'users',
          entity_id: userId || String(tgId),
          details: { role, telegramUserId: tgId },
        });
      }

      return res.status(200).json({ success: true, message: 'Foydalanuvchi ma\'lumotlari yangilandi' });
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  // 3. DELETE / POST(action='wipe'): Full wipe for user (DB, bot history, parcels, academy progress)
  if (req.method === 'DELETE' || (req.method === 'POST' && req.body?.action === 'wipe')) {
    const userId = (req.query?.userId || req.query?.id || req.body?.userId || req.body?.id) as string;
    const customerCode = (req.query?.customerCode || req.body?.customerCode) as string;
    const telegramUserId = (req.query?.telegramUserId || req.body?.telegramUserId) as string | number;

    if (!userId && !customerCode && !telegramUserId) {
      return res.status(400).json({
        error: 'Foydalanuvchi identifikatori (userId, customerCode yoki telegramUserId) talab qilinadi',
      });
    }

    // A. Wipe from in-memory engine stores
    if (telegramUserId) wipeBotUser(telegramUserId);
    if (customerCode) wipeBotUser(customerCode);
    if (userId) wipeBotUser(userId);

    // B. Wipe from Supabase if connected
    if (supabase) {
      try {
        let targetUser: any = null;
        if (userId) {
          const { data } = await supabase.from('users').select('*').eq('id', userId).single();
          targetUser = data;
        } else if (customerCode) {
          const { data } = await supabase.from('users').select('*').eq('customer_code', customerCode.toUpperCase()).single();
          targetUser = data;
        } else if (telegramUserId) {
          const { data } = await supabase.from('users').select('*').eq('telegram_user_id', Number(telegramUserId)).single();
          targetUser = data;
        }

        const effectiveUserId = targetUser?.id || userId;
        const effectiveCustomerCode = targetUser?.customer_code || customerCode;
        const effectiveTgId = targetUser?.telegram_user_id || telegramUserId;

        // Wipe parcels
        if (effectiveCustomerCode) {
          await supabase.from('parcels').delete().eq('customer_code', effectiveCustomerCode);
        }
        if (effectiveUserId) {
          await supabase.from('parcels').delete().eq('user_id', effectiveUserId);
          await supabase.from('location_requests').delete().eq('user_id', effectiveUserId);
          await supabase.from('oferta_acceptances').delete().eq('user_id', effectiveUserId);
          // academy progress/access rows are removed automatically (ON DELETE CASCADE)
          await supabase.from('users').delete().eq('id', effectiveUserId);
        }

        await supabase.from('admin_audit_logs').insert({
          admin_telegram_id: session.telegramUserId,
          action: 'USER_FULL_WIPE',
          entity_type: 'users',
          entity_id: effectiveUserId || 'unknown',
          details: { customerCode: effectiveCustomerCode, telegramUserId: effectiveTgId },
        });
      } catch (err) {
        console.error('Supabase user wipe error:', err);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Mijoz (${customerCode || userId || telegramUserId}) va uning barcha ma'lumotlari (bot tarixi, yuklari, darslari) butunlay o'chirildi (Full Wipe).`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
