/**
 * ==============================================================================
 * LOCAL BOT POLLER (DEV TESTER)
 * ==============================================================================
 * Runs long-polling against Telegram Bot API and processes updates directly.
 *
 * Usage:
 *   npm run bot:poll
 */

import { processTelegramUpdate } from '../api/_lib/botEngine.ts';
import { getBotToken } from '../api/_lib/botNotifications.ts';

const botToken = getBotToken();

if (!botToken) {
  console.log('\n⚠️ BOT_TOKEN topilmadi.');
  console.log('Botni Telegramda hoziroq ishlatish uchun .env fayliga BOT_TOKEN ni kiriting:');
  console.log('  1. Telegramda @BotFather ga kiring va /newbot qiling.');
  console.log('  2. Berilgan tokenni .env faylidagi BOT_TOKEN= qatoriga yozing.');
  console.log('  3. So\'ng qaytadan "npm run bot:poll" buyrug\'ini bering!\n');
  process.exit(0);
}

let lastOffset = 0;
let isRunning = true;

async function pollUpdates() {
  console.log('\n🤖 Yukla Go Telegram Bot Poller ishga tushdi!');
  console.log(`📡 Telegram API bilan bog'lanilmoqda (Token: ${botToken.slice(0, 6)}...)...`);

  // Delete webhook first to allow getUpdates
  try {
    const delRes = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
    const delData = await delRes.json();
    if (delData.ok) {
      console.log('✓ Eski webhook muvaffaqiyatli o\'chirildi (polling rejimiga o\'tildi).');
    }
  } catch {}

  console.log('🚀 Bot tayyor! Telegramda botingizga /start deb yozing.\n');

  while (isRunning) {
    try {
      const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastOffset}&timeout=25`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastOffset = update.update_id + 1;
          const userSender = update.message?.from?.first_name || update.callback_query?.from?.first_name || 'User';
          const msgText = update.message?.text || update.callback_query?.data || '[Action]';
          console.log(`[Update #${update.update_id}] ${userSender}: ${msgText}`);

          // Process update directly in-process
          try {
            await processTelegramUpdate(update);
            console.log(`✓ Javob yuborildi: [Update #${update.update_id}]`);
          } catch (err: any) {
            console.error('Xatolik:', err.message);
          }
        }
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err: any) {
      console.error('Tarmoq xatosi:', err.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

process.on('SIGINT', () => {
  console.log('\nBot poller to\'xtatildi.');
  isRunning = false;
  process.exit(0);
});

pollUpdates();
