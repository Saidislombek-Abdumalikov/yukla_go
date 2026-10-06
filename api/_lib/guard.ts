import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySessionToken, isAdminSession, type SessionPayload } from './auth.ts';
import { getActiveUser, StoreError, type DbUser } from './academyStore.ts';
import { getSupabase } from './supabase.ts';

/** Sends the right HTTP error for anything thrown by the store. */
export function sendError(res: VercelResponse, err: unknown) {
  if (err instanceof StoreError) return res.status(err.status).json({ error: err.message });
  console.error('Unhandled API error:', err);
  return res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
}

/**
 * Requires a valid session whose user really exists in the DB and is not blocked.
 * Returns null after sending the 401/403 response itself.
 */
export async function requireUser(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ session: SessionPayload; user: DbUser; isAdmin: boolean } | null> {
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    res.status(401).json({ error: 'Kirish talab qilinadi' });
    return null;
  }
  try {
    const user = await getActiveUser(session.userId, session.telegramUserId);
    return { session, user, isAdmin: isAdminSession(session) };
  } catch (err) {
    sendError(res, err);
    return null;
  }
}

/** Requires an admin session. Returns null after sending 401/403 itself. */
export function requireAdmin(req: VercelRequest, res: VercelResponse): SessionPayload | null {
  const session = verifySessionToken(req.headers.authorization);
  if (!session) {
    res.status(401).json({ error: 'Kirish talab qilinadi' });
    return null;
  }
  if (!isAdminSession(session)) {
    res.status(403).json({ error: 'Ruxsat berilmagan' });
    return null;
  }
  return session;
}

/** Best-effort audit trail; never breaks the request. */
export async function audit(session: SessionPayload, action: string, entityType: string, entityId: string, details: object = {}) {
  try {
    await getSupabase()?.from('admin_audit_logs').insert({
      admin_telegram_id: session.telegramUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch {
    // ignore
  }
}
