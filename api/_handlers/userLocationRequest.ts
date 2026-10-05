import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth.ts';
import { getSupabase } from '../_lib/supabase.ts';
import { LocationRequestSchema } from '../_lib/validation.ts';
import { checkRateLimit } from '../_lib/rateLimiter.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
  }

  const rateLimit = checkRateLimit(`loc:${session.userId}`, 5, 600);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'Juda ko\'p so\'rov yuborildi. Keyinroq urinib ko\'ring.' });
  }

  const parsed = LocationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Noto\'g\'ri ma\'lumot' });
  }

  const { requestedBranchId } = parsed.data;
  const supabase = getSupabase();

  if (!supabase) {
    return res.status(200).json({ success: true, message: 'So\'rov yuborildi (Dev Mode)' });
  }

  try {
    // 1. Get user's current branch
    const { data: user } = await supabase
      .from('users')
      .select('default_delivery_branch_id')
      .eq('id', session.userId)
      .single();

    // 2. Verify requested branch exists and is active
    const { data: newBranch } = await supabase
      .from('delivery_branches')
      .select('id')
      .eq('id', requestedBranchId)
      .eq('active', true)
      .single();

    if (!newBranch) {
      return res.status(400).json({ error: 'Tanlangan filial mavjud emas yoki faol emas' });
    }

    // 3. Create change request
    const { data: request, error: insertError } = await supabase
      .from('delivery_change_requests')
      .insert({
        user_id: session.userId,
        old_branch_id: user?.default_delivery_branch_id || null,
        requested_branch_id: requestedBranchId,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: 'So\'rovni saqlashda xatolik yuz berdi' });
    }

    return res.status(200).json({
      success: true,
      message: 'Yetkazib berish manzilini o\'zgartirish so\'rovi yuborildi. Administrator tasdiqlashini kuting.',
      requestId: request.id,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Tizim xatosi' });
  }
}
