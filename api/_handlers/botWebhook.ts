import { processTelegramUpdate } from '../_lib/botEngine.ts';
import { sendSafeJson } from '../_router.ts';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'yukla_go_secret_webhook_token_2026';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendSafeJson(res, 405, { error: 'Method not allowed' });
  }

  // Webhook secret token validation
  if (WEBHOOK_SECRET) {
    const receivedSecret = req.headers?.['x-telegram-bot-api-secret-token'];
    if (receivedSecret && receivedSecret !== WEBHOOK_SECRET) {
      return sendSafeJson(res, 401, { error: 'Invalid secret token' });
    }
  }

  let update = req.body;

  if (typeof update === 'string') {
    try {
      update = JSON.parse(update);
    } catch {}
  }

  if (!update && req.on) {
    try {
      const buffers: any[] = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const raw = Buffer.concat(buffers).toString('utf-8');
      if (raw) update = JSON.parse(raw);
    } catch {}
  }

  if (!update) {
    return sendSafeJson(res, 200, { ok: true });
  }

  try {
    await processTelegramUpdate(update);
  } catch (err) {
    console.error('Webhook update handling error:', err);
  }

  return sendSafeJson(res, 200, { ok: true });
}
