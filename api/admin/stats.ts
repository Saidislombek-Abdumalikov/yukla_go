import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken } from '../_lib/auth';
import { getSupabase } from '../_lib/supabase';

import { getInMemoryBotUsers } from '../_lib/botEngine';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifySessionToken(req.headers.authorization);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    return res.status(403).json({ error: 'Ruxsat berilmagan: Faqat administratorlar uchun' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    const memUsers = getInMemoryBotUsers();
    return res.status(200).json({
      totalUsers: memUsers.length,
      activeParcels: 0,
      unsubmittedTracks: 0,
      pendingLocationRequests: 0,
      deliveredParcels: 0,
    });
  }

  try {
    const [
      { count: totalUsers },
      { count: activeParcels },
      { count: unsubmittedTracks },
      { count: pendingLocationRequests },
      { count: deliveredParcels },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('parcels').select('*', { count: 'exact', head: true }).neq('status', 'delivered'),
      supabase.from('parcels').select('*', { count: 'exact', head: true }).is('cargo_submitted_at', null),
      supabase.from('delivery_change_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('parcels').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
    ]);

    return res.status(200).json({
      totalUsers: totalUsers || 0,
      activeParcels: activeParcels || 0,
      unsubmittedTracks: unsubmittedTracks || 0,
      pendingLocationRequests: pendingLocationRequests || 0,
      deliveredParcels: deliveredParcels || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Xatolik yuz berdi' });
  }
}
