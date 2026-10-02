/**
 * Automated script to set Telegram Webhook for Yukla Go
 * Usage: node --experimental-strip-types scripts/setup-webhook.ts
 */

const botToken = process.env.BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const miniAppUrl = process.env.MINI_APP_URL;

if (!botToken) {
  console.error('❌ Xatolik: .env faylida BOT_TOKEN ko\'rsatilmagan.');
  process.exit(1);
}

if (!miniAppUrl) {
  console.error('❌ Xatolik: .env faylida MINI_APP_URL ko\'rsatilmagan (Masalan: https://yukla-go.vercel.app).');
  process.exit(1);
}

const webhookUrl = `${miniAppUrl.replace(/\/$/, '')}/api/bot/webhook`;

async function configureWebhook() {
  console.log(`Setting Telegram Webhook to: ${webhookUrl}...`);
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret || undefined,
        allowed_updates: ['message', 'callback_query'],
      }),
    });

    const data = await res.json();
    if (data.ok) {
      console.log('✅ Webhook muvaffaqiyatli o\'rnatildi!');
      console.log(data);
    } else {
      console.error('❌ Telegram xatosi:', data.description);
    }
  } catch (err: any) {
    console.error('❌ Tarmoq xatosi:', err.message);
  }
}

configureWebhook();
