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
const DEFAULT_ADMIN_TELEGRAM_IDS = [7232597769, 5059829001];

function loadAdminIds(): number[] {
  const fromEnv = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0);
  return Array.from(new Set([...DEFAULT_ADMIN_TELEGRAM_IDS, ...fromEnv]));
}

export const ADMIN_TELEGRAM_IDS: number[] = loadAdminIds();

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
 * @param maxAgeSeconds Maximum allowable age for auth_date (defaults to 24 hours)
 * @param tokenOverride Optional bot token override for testing
 */
export function validateTelegramInitData(
  initData: string,
  maxAgeSeconds = 86400,
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
 * JWT signing secret. There is NO default: if it is missing or weak the server
 * refuses to issue or accept sessions (fail closed).
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters');
  }
  return secret;
}

/**
 * Creates a signed JWT session (HS256).
 */
export function createSessionToken(payload: SessionPayload, expiresIn: string | number = '7d'): string {
  return jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256', expiresIn: expiresIn as any });
}

/**
 * Verifies Bearer session token from HTTP request header. Returns null on any problem.
 */
export function verifySessionToken(authHeader: string | undefined): SessionPayload | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as SessionPayload;
    if (!decoded || typeof decoded.telegramUserId !== 'number' || !decoded.userId) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function isAdminSession(session: SessionPayload | null): boolean {
  return Boolean(session && (session.role === 'admin' || session.role === 'super_admin'));
}
