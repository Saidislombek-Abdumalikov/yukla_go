# Yukla Go - what changed and how to deploy it

## 1. Do this first (security)
The old zip contained a real `.env`. Treat those keys as leaked and replace them:
1. **Bot token**: @BotFather -> /revoke -> new token.
2. **Supabase service role key**: Project Settings -> API -> reset it.
3. **JWT_SECRET** and **TELEGRAM_WEBHOOK_SECRET**: new random values.
4. Put the new values in Vercel -> Settings -> Environment Variables (and a local `.env` copied from `.env.example`).

## 2. Database
In the Supabase SQL editor run, in this order (skip any you already ran):
`supabase/migrations/0001_initial_schema.sql`, `0002_academy_lms.sql`, `0003_academy_access.sql`.
`0003` adds the real `academy_access` table. Students who were "granted" under the old
version (stored in a JSON setting) must be granted again from the admin panel.

## 3. Deploy
Push to Vercel (build runs automatically), then register the webhook: `npm run bot:webhook`.

## 4. What was fixed
| Problem | Fix |
|---|---|
| Anyone could become super admin with a "key" (JWT secret, `yukla2026`, the admin Telegram IDs...) | Admin key login removed. Admin = Telegram-signed ID in the whitelist (or `user_roles` table). |
| JWT secret had a hardcoded default | No default. Server refuses to run sessions without a 32+ char `JWT_SECRET`. |
| `/api/admin/academy` allowed requests with no login | Requires a valid admin session (401/403). |
| Academy treated no login as `guest_user` | Every academy call needs a real, non-blocked user (401/403). |
| Lessons, progress, access lived in server memory (lost on Vercel) | All stored in Supabase tables. |
| Progress could be posted for any lesson | Server checks course access + that the lesson is unlocked. |
| Locked lessons exposed their YouTube ID | Video ID is only sent for lessons the student can watch now. |
| Access request trusted name/code/ID from the request body | Identity comes only from the session. |
| Search by name was built by string-pasting into a DB filter | Safe single-column lookups. |
| Login silently created a session even when the DB failed | Fails closed (503). |
| `vite-dev-api.ts` was a 900-line fake copy of the whole API | Replaced with a tiny bridge to the real handlers. |

## 4b. Account confusion fix (buttons opening "a new account", admin not opening)
Cause: the app took the user's identity from the link (`?code=...&name=...`) and from saved
browser data, and fell back to a made-up account ("YK-001") whenever the server call failed.
Different bot buttons use different links, so they looked like different accounts, and the
admin screen waited on a saved token that could be stale or missing.
Now: every open signs in from Telegram's signed data, the profile always comes from the server,
the link text is ignored, a different Telegram account on the same phone never sees the previous
account's data, and the admin panel opens only when the server says that Telegram ID is an admin.
If login fails the app shows the real reason with a "Qayta urinish" button instead of a fake account.
Outside Telegram (plain browser) the app only shows the "open via Telegram" page.

## 5. Known limits (honest list)
- Videos are **YouTube unlisted**: a determined student can still copy the video ID from their own session
  (the moving ID watermark deters sharing, it does not prevent it). For real protection, move to
  Bunny Stream / Vimeo with signed links later - only `youtube_video_id` handling needs to change.
- The bot (`botEngine.ts`) still keeps part of its chat state in memory; on serverless that can reset between messages. Next thing to move to the database.
- The rate limiter is per server instance (weak on serverless).

## 6. Run locally
`npm install`, copy `.env.example` to `.env` and fill it (use a Supabase **dev** project), `npm run dev`, `npm test`.
