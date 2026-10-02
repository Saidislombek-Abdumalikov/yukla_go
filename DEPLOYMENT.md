# Yukla Go — Deployment & Setup Guide

This guide describes how to deploy Yukla Go from scratch to production.

---

## 1. Supabase (Database) Setup

1. Create a free account at [supabase.com](https://supabase.com) and create a new project.
2. In your Supabase project dashboard, open **SQL Editor**.
3. Copy and paste the entire content of [`supabase/migrations/0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql) and click **Run**.
4. Go to **Project Settings** $\to$ **API**:
   - Copy **Project URL** (`SUPABASE_URL`)
   - Copy **service_role secret** (`SUPABASE_SERVICE_ROLE_KEY`)

---

## 2. Telegram Bot (@BotFather) Setup

1. Open Telegram and message **[@BotFather](https://t.me/BotFather)**.
2. Send `/newbot`, choose a name (`Yukla Go`) and a username (e.g. `yuklago_bot`).
3. Copy the HTTP API token (`BOT_TOKEN`).
4. Configure the WebApp menu button:
   - Send `/setmenubutton`
   - Select your bot
   - Send title: `📦 Yukla Go`
   - Send URL: `https://your-domain.vercel.app`

---

## 3. Vercel Deployment

1. Push this project to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Under **Environment Variables**, add:
   ```env
   BOT_TOKEN=your_bot_token_from_botfather
   TELEGRAM_WEBHOOK_SECRET=your_random_secret_token
   MINI_APP_URL=https://your-domain.vercel.app
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret
   JWT_SECRET=your_random_jwt_secret_min_32_chars
   ```
4. Click **Deploy**.

---

## 4. Register Telegram Webhook

Once deployed to Vercel, run:
```bash
npm run bot:webhook
```
Or use `curl`:
```bash
curl -F "url=https://your-domain.vercel.app/api/bot/webhook" \
     -F "secret_token=your_random_secret_token" \
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

---

## 5. Helpful Commands

- `npm run dev` — Run frontend locally on port 3000
- `npm test` — Run security audit, E2E integration tests, and Telegram bot tests
- `npm run bot:poll` — Run local long-polling Telegram bot tester without deploying
- `npm run bot:webhook` — Set Telegram bot webhook and commands menu automatically
- `npm run db:verify` — Verify Supabase tables and connection
