import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { getSupabase } from '../_lib/supabase';
import { notifyParcelStatusUpdate } from '../_lib/botNotifications';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Ruxsat berilmagan' });
  }

  const supabase = getSupabase();

  // -------------------------------------------------------------
  // GET: Filterable admin parcel list
  // -------------------------------------------------------------
  if (req.method === 'GET') {
    if (!supabase) {
      return res.status(200).json([]);
    }

    try {
      const { search, status, unsubmitted, limit = '100', offset = '0' } = req.query;

      let query = supabase
        .from('parcels')
        .select(`
          id,
          tracking_number,
          customer_code_snapshot,
          status,
          payment_status,
          amount,
          currency,
          weight_kg,
          delivery_address_snapshot,
          cargo_address_snapshot,
          cargo_submitted_at,
          created_at
        `)
        .order('created_at', { ascending: false })
        .range(parseInt(String(offset), 10), parseInt(String(offset), 10) + parseInt(String(limit), 10) - 1);

      if (status) {
        query = query.eq('status', String(status));
      }

      if (unsubmitted === 'true') {
        query = query.is('cargo_submitted_at', null);
      }

      if (search) {
        const s = String(search).trim();
        query = query.or(`tracking_number.ilike.%${s}%,customer_code_snapshot.ilike.%${s}%`);
      }

      const { data: parcels, error } = await query;
      if (error) {
        return res.status(500).json({ error: 'Yuklarni yuklashda xatolik' });
      }

      const formatted = (parcels || []).map(p => ({
        id: p.id,
        trackingNumber: p.tracking_number,
        customerCode: p.customer_code_snapshot,
        status: p.status,
        paymentStatus: p.payment_status,
        weightKg: Number(p.weight_kg) || 0,
        amount: Number(p.amount) || 0,
        currency: p.currency,
        deliveryBranchSnapshot: p.delivery_address_snapshot,
        cargoAddressSnapshot: p.cargo_address_snapshot,
        cargoSubmittedAt: p.cargo_submitted_at,
        createdAt: p.created_at,
      }));

      return res.status(200).json(formatted);
    } catch (err) {
      return res.status(500).json({ error: 'Xatolik yuz berdi' });
    }
  }

  // -------------------------------------------------------------
  // PATCH: Bulk status, bulk payment, or mark cargo submitted
  // -------------------------------------------------------------
  if (req.method === 'PATCH') {
    const { action, parcelIds, value } = req.body || {};
    if (!Array.isArray(parcelIds) || parcelIds.length === 0) {
      return res.status(400).json({ error: 'parcelIds massivi talab qilinadi' });
    }

    if (!supabase) {
      return res.status(200).json({ success: true, updatedCount: parcelIds.length });
    }

    try {
      let updatePayload: Record<string, any> = {};

      if (action === 'status') {
        if (!['added', 'china_warehouse', 'in_transit', 'uzbekistan', 'delivered'].includes(value)) {
          return res.status(400).json({ error: 'Noto\'g\'ri status' });
        }
        updatePayload.status = value;
      } else if (action === 'payment') {
        if (!['pending', 'paid'].includes(value)) {
          return res.status(400).json({ error: 'Noto\'g\'ri to\'lov holati' });
        }
        updatePayload.payment_status = value;
      } else if (action === 'mark_submitted') {
        updatePayload.cargo_submitted_at = new Date().toISOString();
      } else {
        return res.status(400).json({ error: 'Noma\'lum action' });
      }

      const { error: updateError } = await supabase
        .from('parcels')
        .update(updatePayload)
        .in('id', parcelIds);

      if (updateError) {
        return res.status(500).json({ error: 'Yangilashda xatolik yuz berdi' });
      }

      // Record audit log
      await supabase.from('admin_audit_logs').insert({
        admin_telegram_id: session.telegramUserId,
        action: `BULK_${action.toUpperCase()}`,
        entity_type: 'parcels',
        entity_id: parcelIds.join(','),
        details: { action, value, count: parcelIds.length },
      });

      // Dispatch real-time Telegram status alerts
      if (action === 'status') {
        try {
          const { data: affectedParcels } = await supabase
            .from('parcels')
            .select('id, tracking_number, weight_kg, amount, users:user_id (telegram_user_id)')
            .in('id', parcelIds);

          if (affectedParcels) {
            for (const ap of affectedParcels) {
              const tgId = (ap as any).users?.telegram_user_id;
              if (tgId) {
                notifyParcelStatusUpdate(
                  tgId,
                  ap.tracking_number,
                  value,
                  Number(ap.weight_kg) || 0,
                  Number(ap.amount) || 0
                ).catch(() => {});
              }
            }
          }
        } catch {
          // Notification error shouldn't fail the response
        }
      }

      return res.status(200).json({
        success: true,
        updatedCount: parcelIds.length,
        message: `${parcelIds.length} ta yuk muvaffaqiyatli yangilandi`,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Tizim xatoligi' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
