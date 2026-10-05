/**
 * Automated script to configure Telegram Webhook, Bot Commands, and Menu Button for Yukla Go
 * Usage: node --experimental-strip-types scripts/setup-webhook.ts
 */

export {};

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

const cleanAppUrl = miniAppUrl.replace(/\/$/, '');
const webhookUrl = `${cleanAppUrl}/api/bot/webhook`;

async function configureBot() {
  console.log(`--- YUKLA GO TELEGRAM BOTNI SOZLASH ---`);

  // 1. Set Webhook
  console.log(`1. Webhook o'rnatilmoqda: ${webhookUrl}...`);
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret || undefined,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
      }),
    });

    const data = await res.json();
    if (data.ok) {
      console.log('   ✅ Webhook muvaffaqiyatli o\'rnatildi!');
    } else {
      console.error('   ❌ Webhook xatosi:', data.description);
    }
  } catch (err: any) {
    console.error('   ❌ Webhook tarmoq xatosi:', err.message);
  }

  // 2. Set Bot Commands Menu
  console.log('2. Bot komandalari menyusi sozlanmoqda (setMyCommands)...');
  try {
    const commands = [
      { command: 'start', description: 'Botni ishga tushirish / Asosiy menyu' },
      { command: 'academy', description: '🎓 Video darslar (Akademiya)' },
      { command: 'myid', description: 'Mening profilim va mijoz kodim (YK-###)' },
      { command: 'help', description: 'Qo\'llanma va ma\'muriyat bilan bog\'lanish' },
    ];

    const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });

    const data = await res.json();
    if (data.ok) {
      console.log('   ✅ Komandalar muvaffaqiyatli ro\'yxatdan o\'tkazildi!');
    } else {
      console.error('   ❌ Komandalar xatosi:', data.description);
    }
  } catch (err: any) {
    console.error('   ❌ Komandalar tarmoq xatosi:', err.message);
  }

  // 3. Set Web App Menu Button (Bottom left button in Telegram)
  console.log('3. Chat Menu tugmasi sozlanmoqda (setChatMenuButton)...');
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🎓 Video darslar',
          web_app: { url: cleanAppUrl },
        },
      }),
    });

    const data = await res.json();
    if (data.ok) {
      console.log('   ✅ Mini App Chat Menu tugmasi muvaffaqiyatli o\'rnatildi!');
    } else {
      console.error('   ❌ Chat Menu tugmasi xatosi:', data.description);
    }
  } catch (err: any) {
    console.error('   ❌ Chat Menu tarmoq xatosi:', err.message);
  }

  console.log('--- SOZLASH YAKUNLANDI ---');
}

configureBot();
