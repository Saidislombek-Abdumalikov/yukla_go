/**
 * ==============================================================================
 * LOCAL BOT POLLER (DEV TESTER)
 * ==============================================================================
 * Runs long-polling against Telegram Bot API and pipes incoming updates
 * directly into the local webhook endpoint (http://localhost:3000/api/bot/webhook).
 *
 * Usage:
 *   npm run bot:poll
 */

export {};

const botToken = process.env.BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const localWebhookUrl = process.env.LOCAL_WEBHOOK_URL || 'http://localhost:3000/api/bot/webhook';

if (!botToken) {
  console.log('⚠️ BOT_TOKEN topilmadi. Bot poller faqat BOT_TOKEN kiritilganda ishlaydi.');
  console.log('Misol: $env:BOT_TOKEN="123456:ABC..."; npm run bot:poll');
  process.exit(0);
}

let lastOffset = 0;
let isRunning = true;

async function pollUpdates() {
  console.log('🤖 Yukla Go Telegram Bot Poller ishga tushdi...');
  console.log(`Forwarding updates to: ${localWebhookUrl}`);

  // Delete webhook first to allow getUpdates
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
  } catch {}

  while (isRunning) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastOffset}&timeout=25`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastOffset = update.update_id + 1;
          console.log(`[Update #${update.update_id}] Received. Forwarding...`);

          // Post to local webhook
          try {
            await fetch(localWebhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-telegram-bot-api-secret-token': webhookSecret,
              },
              body: JSON.stringify(update),
            });
          } catch (postErr: any) {
            console.error(`Xatolik: local webhook (${localWebhookUrl}) ga yuborilmadi:`, postErr.message);
          }
        }
      } else {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err: any) {
      console.error('Polling xatosi:', err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

process.on('SIGINT', () => {
  console.log('\nBot poller to\'xtatildi.');
  isRunning = false;
  process.exit(0);
});

pollUpdates();
