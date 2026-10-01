import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { getSupabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Ruxsat berilmagan' });
  }

  const supabase = getSupabase();

  // -------------------------------------------------------------
  // GET: List change requests
  // -------------------------------------------------------------
  if (req.method === 'GET') {
    if (!supabase) {
      return res.status(200).json([]);
    }

    try {
      const { data: requests, error } = await supabase
        .from('delivery_change_requests')
        .select(`
          id,
          user_id,
          status,
          created_at,
          user:users (customer_code, name, phone),
          old_branch:old_branch_id (provider, branch_name, region),
          requested_branch:requested_branch_id (provider, branch_name, region)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: 'So\'rovlarni yuklashda xatolik' });
      }

      return res.status(200).json(requests || []);
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik' });
    }
  }

  // -------------------------------------------------------------
  // PATCH: Approve or Reject
  // -------------------------------------------------------------
  if (req.method === 'PATCH') {
    const { requestId, status, note } = req.body || {};
    if (!requestId || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'requestId va status (approved/rejected) talab qilinadi' });
    }

    if (!supabase) {
      return res.status(200).json({ success: true, status });
    }

    try {
      // 1. Fetch request details
      const { data: request, error: reqError } = await supabase
        .from('delivery_change_requests')
        .select('id, user_id, requested_branch_id, status')
        .eq('id', requestId)
        .single();

      if (reqError || !request) {
        return res.status(404).json({ error: 'So\'rov topilmadi' });
      }

      // 2. If approved, update user's default branch
      if (status === 'approved') {
        await supabase
          .from('users')
          .update({ default_delivery_branch_id: request.requested_branch_id })
          .eq('id', request.user_id);
      }

      // 3. Update request status
      await supabase
        .from('delivery_change_requests')
        .update({
          status,
          reviewed_by: session.telegramUserId,
          admin_note: note || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      // 4. Audit log
      await supabase.from('admin_audit_logs').insert({
        admin_telegram_id: session.telegramUserId,
        action: `LOCATION_REQUEST_${status.toUpperCase()}`,
        entity_type: 'delivery_change_requests',
        entity_id: requestId,
        details: { userId: request.user_id, status, requestedBranchId: request.requested_branch_id },
      });

      return res.status(200).json({
        success: true,
        message: status === 'approved' ? 'Manzil o\'zgartirish tasdiqlandi' : 'Manzil so\'rovi rad etildi',
      });
    } catch (err) {
      return res.status(500).json({ error: 'Tizim xatosi' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
