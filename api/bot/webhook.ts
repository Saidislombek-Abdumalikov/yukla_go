import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processTelegramUpdate } from '../_lib/botEngine.ts';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Webhook secret token validation
  if (WEBHOOK_SECRET) {
    const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (receivedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid secret token' });
    }
  }

  const update = req.body;
  if (!update) {
    return res.status(200).json({ ok: true });
  }

  try {
    await processTelegramUpdate(update);
  } catch (err) {
    console.error('Webhook update handling error:', err);
  }

  return res.status(200).json({ ok: true });
}
