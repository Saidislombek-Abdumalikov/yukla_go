import crypto from 'crypto';

/** Builds a correctly signed Telegram Mini App initData string. */
export function signInitData(botToken: string, user: object, authDate = Math.floor(Date.now() / 1000)): string {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAH', user: JSON.stringify(user) });
  const dcs = Array.from(params.keys()).sort().map(k => `${k}=${params.get(k)}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

/** Minimal Vercel-style req/res pair for calling handlers directly. */
export function mockReqRes(opts: { method?: string; body?: any; query?: any; headers?: Record<string, string> } = {}) {
  const req: any = { method: opts.method || 'GET', body: opts.body, query: opts.query || {}, headers: opts.headers || {}, url: '/' };
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(b: any) { out.body = b; return res; },
    setHeader() { return res; },
  };
  return { req, res, out };
}
