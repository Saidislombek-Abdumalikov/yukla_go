import type { VercelRequest, VercelResponse } from '@vercel/node';

import handleBotWebhook from './_handlers/botWebhook.ts';
import handleState from './_handlers/state.ts';
import handleUser from './_handlers/user.ts';

export function sendSafeJson(res: any, statusCode: number, data: any) {
  try {
    if (typeof res.status === 'function') {
      if (typeof res.json === 'function') {
        return res.status(statusCode).json(data);
      }
      res.status(statusCode);
      if (res.setHeader) res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(data));
    }
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end(JSON.stringify(data));
  } catch (e) {
    try {
      res.end(JSON.stringify(data));
    } catch {}
  }
}

export default async function handler(req: any, res: any) {
  try {
    const rawUrl = req.url || '';
    const urlObj = new URL(rawUrl, 'http://localhost');
    let pathname = urlObj.pathname.replace(/\/$/, '');

    if (!req.query) req.query = {};
    for (const [key, value] of urlObj.searchParams.entries()) {
      req.query[key] = value;
    }

    const pathParam = req.query?.__path || urlObj.searchParams.get('__path');
    const normalizedPath = (pathname === '/api' || pathname === '') && pathParam
      ? `/api/${String(pathParam).replace(/^\//, '').split('?')[0]}`
      : pathname;

    switch (normalizedPath) {
      case '/api/bot/webhook':
        return await handleBotWebhook(req, res);

      case '/api/state':
      case '/api':
      case '':
        return await handleState(req, res);

      case '/api/user':
        return await handleUser(req, res);

      default:
        // If path starts with state or academy
        if (normalizedPath.includes('state') || normalizedPath.includes('academy')) {
          return await handleState(req, res);
        }
        return sendSafeJson(res, 404, {
          error: 'API endpoint topilmadi',
          path: normalizedPath,
        });
    }
  } catch (err: any) {
    console.error('Fatal API router error:', err);
    return sendSafeJson(res, 500, { error: err.message || 'Server error' });
  }
}
