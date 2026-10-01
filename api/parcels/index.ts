import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { getSupabase } from '../_lib/supabase';
import { AddParcelsPayloadSchema } from '../_lib/validation';
import { checkRateLimit } from '../_lib/rateLimiter';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
  }

  const supabase = getSupabase();

  // -------------------------------------------------------------
  // GET: Fetch parcels owned by authenticated user (Strict IDOR protection)
  // -------------------------------------------------------------
  if (req.method === 'GET') {
    if (!supabase) {
      // Development mock parcels
      return res.status(200).json([
        {
          id: 'p_1',
          trackingNumber: 'YT882910291CN',
          customerCode: session.customerCode,
          status: 'in_transit',
          paymentStatus: 'pending',
          weightKg: 3.5,
          amount: 33.25,
          currency: 'USD',
          chinaDate: '28.09.2026',
          estimatedArrival: '05.10.2026',
          deliveryBranchSnapshot: {
            provider: 'BTS',
            branchName: 'BTS Chorsu',
            region: 'Namangan',
            address: 'Namangan sh., Chorsu dahasi, 12-uy',
          },
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    try {
      const { data: parcels, error } = await supabase
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
          image_url,
          delivery_address_snapshot,
          cargo_address_snapshot,
          cargo_submitted_at,
          created_at
        `)
        .eq('user_id', session.userId)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ error: 'Yuklarni yuklashda xatolik' });
      }

      // Map to frontend-friendly camelCase structure
      const formatted = (parcels || []).map(p => ({
        id: p.id,
        trackingNumber: p.tracking_number,
        customerCode: p.customer_code_snapshot,
        status: p.status,
        paymentStatus: p.payment_status,
        weightKg: Number(p.weight_kg) || 0,
        amount: Number(p.amount) || 0,
        currency: p.currency,
        imageUrl: p.image_url,
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
  // POST: Add new tracking number(s)
  // -------------------------------------------------------------
  if (req.method === 'POST') {
    const rateLimit = checkRateLimit(`track:${session.userId}`, 25, 60);
    if (!rateLimit.allowed) {
      return res.status(429).json({ error: 'Juda ko\'p so\'rov yuborildi. Iltimos, bir daqiqadan so\'ng urinib ko\'ring.' });
    }

    // Support either single `trackingNumber` or array `trackingNumbers`
    const body = req.body || {};
    let trackList: string[] = [];
    if (typeof body.trackingNumber === 'string') {
      trackList = [body.trackingNumber];
    } else if (Array.isArray(body.trackingNumbers)) {
      trackList = body.trackingNumbers;
    }

    const parsed = AddParcelsPayloadSchema.safeParse({ trackingNumbers: trackList });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Noto\'g\'ri trek formati' });
    }

    const trackingNumbers = parsed.data.trackingNumbers;

    if (!supabase) {
      return res.status(200).json({
        success: true,
        message: `${trackingNumbers.length} ta trek muvaffaqiyatli qo'shildi (Dev Mode)`,
      });
    }

    try {
      // 1. Fetch user's approved delivery branch for immutable snapshot
      const { data: user } = await supabase
        .from('users')
        .select(`
          default_delivery_branch_id,
          delivery_branches:default_delivery_branch_id (
            id, provider, branch_name, region, district, address, phone
          )
        `)
        .eq('id', session.userId)
        .single();

      const branch = (user as any)?.delivery_branches;
      const deliverySnapshot = branch ? {
        provider: branch.provider,
        branchName: branch.branch_name,
        region: branch.region,
        district: branch.district,
        address: branch.address,
        phone: branch.phone,
      } : {
        provider: 'Standard',
        branchName: 'Standart yetkazish',
        region: 'O\'zbekiston',
        address: 'Markaziy ombor',
      };

      // 2. Fetch active China cargo provider for immutable snapshot
      const { data: activeProvider } = await supabase
        .from('cargo_providers')
        .select('id, phone, province, city, district, full_address, warehouse_code')
        .eq('active', true)
        .single();

      const cargoSnapshot = activeProvider ? {
        warehouseCode: activeProvider.warehouse_code,
        fullAddress: `${activeProvider.province} ${activeProvider.city} ${activeProvider.full_address}`,
        phone: activeProvider.phone,
      } : {
        warehouseCode: '077库房',
        fullAddress: 'Zhejiang Jinhua Yiwu',
        phone: '13335957161',
      };

      const results = [];
      const duplicateErrors: string[] = [];

      for (const rawTrack of trackingNumbers) {
        const cleanTrack = rawTrack.toUpperCase();

        // Check if track already exists globally
        const { data: existing } = await supabase
          .from('parcels')
          .select('id')
          .eq('tracking_number', cleanTrack)
          .single();

        if (existing) {
          // Security rule: Never reveal whose account owns the track
          duplicateErrors.push(cleanTrack);
          continue;
        }

        const { data: newParcel, error: insertError } = await supabase
          .from('parcels')
          .insert({
            user_id: session.userId,
            tracking_number: cleanTrack,
            customer_code_snapshot: session.customerCode,
            cargo_provider_id: activeProvider?.id || null,
            cargo_address_snapshot: cargoSnapshot,
            delivery_branch_id: user?.default_delivery_branch_id || null,
            delivery_address_snapshot: deliverySnapshot,
            status: 'added',
            payment_status: 'pending',
            amount: 0,
            currency: 'USD',
            weight_kg: 0,
          })
          .select()
          .single();

        if (!insertError && newParcel) {
          results.push(newParcel);
        }
      }

      if (results.length === 0 && duplicateErrors.length > 0) {
        return res.status(409).json({
          error: 'Ushbu trek raqam(lar) allaqachon tizimga kiritilgan.',
        });
      }

      return res.status(201).json({
        success: true,
        addedCount: results.length,
        duplicatesCount: duplicateErrors.length,
        message: `${results.length} ta trek muvaffaqiyatli saqlandi.${duplicateErrors.length > 0 ? ` (${duplicateErrors.length} ta dublikat o'tkazib yuborildi)` : ''}`,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Tizim xatoligi yuz berdi' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
