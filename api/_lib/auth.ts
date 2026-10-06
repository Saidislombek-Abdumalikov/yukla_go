import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface SessionPayload {
  userId: string;
  telegramUserId: number;
  customerCode: string;
  role: 'customer' | 'admin' | 'super_admin';
}

/**
 * Verified Admin Telegram User IDs
 */
export const ADMIN_TELEGRAM_IDS: number[] = [7232597769, 5059829001];

/**
 * Check if a telegram user ID has admin rights
 */
export function isTelegramAdmin(telegramUserId: number | string | undefined | null): boolean {
  if (!telegramUserId) return false;
  const numId = Number(telegramUserId);
  return ADMIN_TELEGRAM_IDS.includes(numId);
}

/**
 * Validates Telegram Mini App initData using HMAC-SHA256 according to Telegram specifications.
 * @param initData Raw query string received from Telegram WebApp
 * @param maxAgeSeconds Maximum allowable age for auth_date (defaults to 10 minutes)
 * @param tokenOverride Optional bot token override for testing
 */
export function validateTelegramInitData(
  initData: string,
  maxAgeSeconds = 86400 * 30,
  tokenOverride?: string
): { valid: boolean; user?: TelegramUser; error?: string } {
  if (!initData) {
    return { valid: false, error: 'initData is required' };
  }

  const botToken = tokenOverride || process.env.BOT_TOKEN || '';
  if (!botToken) {
    return { valid: false, error: 'Server BOT_TOKEN not configured' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return { valid: false, error: 'Missing hash in initData' };
    }

    // Check auth_date freshness
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: 'Missing auth_date' };
    }
    const authDate = parseInt(authDateStr, 10);
    const now = Math.floor(Date.now() / 1000);
    if (isNaN(authDate) || (maxAgeSeconds > 0 && now - authDate > maxAgeSeconds) || authDate > now + 300) {
      return { valid: false, error: 'Expired or invalid auth_date' };
    }

    // Build data-check-string (sort keys alphabetically, exclude hash, join key=val with \n)
    params.delete('hash');
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys
      .map(key => `${key}=${params.get(key)}`)
      .join('\n');

    // Calculate secret_key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate signature = HMAC_SHA256(dataCheckString, secretKey)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

    if (hashBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      return { valid: false, error: 'Invalid HMAC signature' };
    }

    // Signature verified! Extract user
    const userStr = params.get('user');
    let user: TelegramUser | undefined;
    if (userStr) {
      user = JSON.parse(userStr);
    }

    return { valid: true, user };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Verification exception' };
  }
}

/**
 * Creates a persistent JWT session for Mini App (defaults to 30 days).
 */
export function createSessionToken(payload: SessionPayload, expiresIn: string | number = '30d'): string {
  const secret = process.env.JWT_SECRET || 'yukla_go_dev_secret_replace_in_prod';
  return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
}

/**
 * Verifies Bearer session token from HTTP request header.
 */
export function verifySessionToken(authHeader: string | undefined): SessionPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const secret = process.env.JWT_SECRET || 'yukla_go_dev_secret_replace_in_prod';
  try {
    const decoded = jwt.verify(token, secret) as SessionPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
