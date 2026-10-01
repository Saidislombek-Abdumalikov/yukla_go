interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Persistent in-memory map across invocations within the same serverless instance
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Basic rate limiter for serverless environments.
 * @param key Identifier (e.g. `auth:${ip}` or `track:${userId}`)
 * @param maxRequests Maximum requests allowed within window
 * @param windowSeconds Window length in seconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    };
    rateLimitStore.set(key, newRecord);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetInSeconds: windowSeconds,
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetInSeconds: Math.ceil((record.resetAt - now) / 1000),
  };
}

export function getClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
