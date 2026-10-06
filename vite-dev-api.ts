import { loadEnv, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Dev-server bridge. It runs the REAL api/_router.ts handlers (the exact code
 * that runs on Vercel) so local behaviour matches production. There is no
 * separate fake API any more.
 *
 * Local setup: copy .env.example to .env and point it at a Supabase dev project.
 */
export function devApiPlugin(): Plugin {
  return {
    name: 'yukla-dev-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url || !req.url.startsWith('/api')) return next();

        try {
          const url = new URL(req.url, 'http://localhost');
          const query: Record<string, string> = {};
          url.searchParams.forEach((v, k) => { query[k] = v; });

          let body: any = undefined;
          if (req.method && !['GET', 'HEAD', 'DELETE'].includes(req.method)) {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const raw = Buffer.concat(chunks).toString('utf8');
            try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
          }

          const vReq: any = req;
          vReq.query = query;
          vReq.body = body;

          const vRes: any = res;
          vRes.status = (code: number) => { res.statusCode = code; return vRes; };
          vRes.json = (data: unknown) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return vRes;
          };

          const mod = await server.ssrLoadModule('/api/_router.ts');
          await mod.default(vReq, vRes);
        } catch (err: any) {
          console.error('[dev-api] error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
          }
          res.end(JSON.stringify({ error: 'Dev API error: ' + (err?.message || 'unknown') }));
        }
      });
    },
  };
}
