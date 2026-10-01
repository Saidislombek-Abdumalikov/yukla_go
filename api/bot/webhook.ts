import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/supabase';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://yukla-go.vercel.app';

// Helper to send message via Telegram Bot API
async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: any) {
  if (!BOT_TOKEN) {
    console.log(`[BOT DEV] Message to ${chatId}: ${text}`);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
  } catch (err) {
    console.error('Telegram API error:', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Webhook secret token validation
  if (WEBHOOK_SECRET) {
    const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (receivedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid secret token' });
    }
  }

  const update = req.body;
  if (!update) {
    return res.status(200).json({ ok: true });
  }

  const message = update.message;
  const callbackQuery = update.callback_query;
  const from = message?.from || callbackQuery?.from;
  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;

  if (!from || !chatId) {
    return res.status(200).json({ ok: true });
  }

  const telegramUserId = from.id;
  const supabase = getSupabase();

  if (!supabase) {
    // If database credentials are not configured yet, send friendly greeting
    await sendTelegramMessage(chatId, `Assalomu alaykum, <b>${from.first_name}</b>!\n\nYukla Go xizmatiga xush kelibsiz. Bot tez orada ishga tushadi.`);
    return res.status(200).json({ ok: true });
  }

  try {
    // 1. Fetch user record if exists
    let { data: user } = await supabase
      .from('users')
      .select(`
        id,
        telegram_user_id,
        customer_code,
        name,
        phone,
        onboarding_completed,
        onboarding_step,
        status,
        default_delivery_branch_id,
        default_branch:default_delivery_branch_id (provider, branch_name, region)
      `)
      .eq('telegram_user_id', telegramUserId)
      .single();

    // 2. Handle Blocked Users
    if (user?.status === 'blocked') {
      await sendTelegramMessage(chatId, '❌ Sizning hisobingiz bloklangan. Iltimos, ma\'muriyat bilan bog\'laning.');
      return res.status(200).json({ ok: true });
    }

    // 3. Handle Callback Queries (Buttons)
    if (callbackQuery) {
      const data = callbackQuery.data;

      // Handle Oferta response
      if (data === 'oferta_accept') {
        const { data: activeOferta } = await supabase
          .from('oferta_versions')
          .select('id')
          .eq('is_active', true)
          .single();

        if (!user) {
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              telegram_user_id: telegramUserId,
              name: from.first_name || 'Mijoz',
              phone: 'pending',
              onboarding_step: 'phone',
            })
            .select()
            .single();
          user = newUser;
        } else {
          await supabase.from('users').update({ onboarding_step: 'phone' }).eq('id', user.id);
        }

        if (user && activeOferta) {
          await supabase.from('oferta_acceptances').insert({
            user_id: user.id,
            telegram_user_id: telegramUserId,
            oferta_version_id: activeOferta.id,
          });
        }

        await sendTelegramMessage(
          chatId,
          '✅ Oferta shartlarini qabul qildingiz.\n\nIltimos, telefon raqamingizni tasdiqlash uchun pastdagi <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosing:',
          {
            keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
        return res.status(200).json({ ok: true });
      }

      if (data === 'oferta_decline') {
        await sendTelegramMessage(chatId, '❌ Siz ofertani qabul qilmadingiz. Yukla Go xizmatidan foydalanish uchun ofertaga rozilik berish zarur.');
        return res.status(200).json({ ok: true });
      }

      // Handle Provider selection
      if (data?.startsWith('provider_')) {
        const provider = data.replace('provider_', '');
        await supabase.from('users').update({ onboarding_step: 'region' }).eq('id', user!.id);

        // Fetch distinct regions for this provider
        const { data: branches } = await supabase
          .from('delivery_branches')
          .select('region')
          .eq('provider', provider)
          .eq('active', true);

        const regions = Array.from(new Set(branches?.map(b => b.region) || []));
        const buttons = regions.map(reg => [{ text: reg, callback_data: `region_${provider}_${reg}` }]);

        await sendTelegramMessage(chatId, `📍 <b>${provider}</b> uchun viloyatingizni tanlang:`, { inline_keyboard: buttons });
        return res.status(200).json({ ok: true });
      }

      // Handle Region selection
      if (data?.startsWith('region_')) {
        const [, provider, region] = data.split('_');
        await supabase.from('users').update({ onboarding_step: 'branch' }).eq('id', user!.id);

        const { data: branches } = await supabase
          .from('delivery_branches')
          .select('id, branch_name')
          .eq('provider', provider)
          .eq('region', region)
          .eq('active', true);

        const buttons = (branches || []).map(b => [{ text: b.branch_name, callback_data: `branch_${b.id}` }]);

        await sendTelegramMessage(chatId, `🏢 O'zingizga yaqin filialni tanlang:`, { inline_keyboard: buttons });
        return res.status(200).json({ ok: true });
      }

      // Handle Branch selection -> Complete Onboarding!
      if (data?.startsWith('branch_')) {
        const branchId = data.replace('branch_', '');

        const { data: updatedUser } = await supabase
          .from('users')
          .update({
            default_delivery_branch_id: branchId,
            onboarding_completed: true,
            onboarding_step: 'completed',
          })
          .eq('id', user!.id)
          .select(`
            customer_code,
            name,
            default_branch:default_delivery_branch_id (provider, branch_name, region)
          `)
          .single();

        const branch = (updatedUser as any)?.default_branch;

        await sendTelegramMessage(
          chatId,
          `🎉 <b>Tabriklaymiz, ro'yxatdan o'tish muvaffaqiyatli yakunlandi!</b>\n\n` +
          `👤 Mijoz kodingiz: <code>${updatedUser?.customer_code}</code>\n` +
          `📍 Filialingiz: <b>${branch?.provider} — ${branch?.branch_name} (${branch?.region})</b>\n\n` +
          `Ilovani ochish va Xitoy ombor manzilingizni olish uchun pastdagi tugmani bosing:`,
          {
            inline_keyboard: [
              [{ text: '📦 Yukla Go ilovasini ochish', web_app: { url: MINI_APP_URL } }]
            ]
          }
        );
        return res.status(200).json({ ok: true });
      }
    }

    // 4. Handle Incoming Messages
    const text = message?.text?.trim();

    // Check if user is already registered and completed
    if (user && user.onboarding_completed) {
      if (text === '/start') {
        const branch = (user as any)?.default_branch;
        await sendTelegramMessage(
          chatId,
          `Xush kelibsiz, <b>${user.name}</b>!\n\n` +
          `Sizning mijoz kodingiz: <code>${user.customer_code}</code>\n` +
          `Tasdiqlangan filial: <b>${branch?.provider || 'Standart'} — ${branch?.branch_name || ''}</b>`,
          {
            inline_keyboard: [
              [{ text: '📦 Yukla Go\'ni ochish', web_app: { url: MINI_APP_URL } }],
              [
                { text: '📍 Filial', callback_data: 'view_branch' },
                { text: '☎️ Yordam', url: 'https://t.me/yuklago_support' }
              ]
            ]
          }
        );
        return res.status(200).json({ ok: true });
      }
    }

    // New or incomplete user flow:
    if (text === '/start') {
      // Step 1: Oferta
      await sendTelegramMessage(
        chatId,
        `Assalomu alaykum! <b>Yukla Go</b> kargo xizmatiga xush kelibsiz.\n\n` +
        `Ro'yxatdan o'tishdan oldin Ommaviy Oferta shartlari bilan tanishib chiqing:\n\n` +
        `<i>1. Yukla Go xizmati Xitoydan O'zbekistonga yuklarni havo orqali yetkazib beradi.\n` +
        `2. Akkumulyator, magnit, suyuqlik va yonuvchan moddalar qat'iyan taqiqlanadi.\n` +
        `3. Mijoz yuk kelgach, uning haqiqiy og'irligiga ko'ra to'lov qiladi.</i>`,
        {
          inline_keyboard: [
            [
              { text: '✅ Roziman', callback_data: 'oferta_accept' },
              { text: '❌ Rozimasman', callback_data: 'oferta_decline' }
            ]
          ]
        }
      );
      return res.status(200).json({ ok: true });
    }

    // Step 2: Receive Contact
    if (message?.contact) {
      const contact = message.contact;
      let phone = contact.phone_number;
      if (!phone.startsWith('+')) phone = '+' + phone;

      if (user) {
        await supabase.from('users').update({
          phone,
          phone_verified_at: new Date().toISOString(),
          onboarding_step: 'name',
        }).eq('id', user.id);
      }

      await sendTelegramMessage(chatId, `Rahmat! Endi ism va familiyangizni kiriting:\n<i>(Masalan: Saidislom Karimiy)</i>`, {
        remove_keyboard: true
      });
      return res.status(200).json({ ok: true });
    }

    // Step 3: Receive Name
    if (user && user.onboarding_step === 'name' && text) {
      if (text.length < 3 || text.length > 60) {
        await sendTelegramMessage(chatId, 'Iltimos, to\'liq ismingizni kiriting (3 tadan 60 tagacha belgi):');
        return res.status(200).json({ ok: true });
      }

      await supabase.from('users').update({
        name: text,
        onboarding_step: 'provider',
      }).eq('id', user.id);

      // Ask for delivery provider
      await sendTelegramMessage(chatId, `Yetkazib berish xizmatini tanlang:`, {
        inline_keyboard: [
          [{ text: 'BTS Pochta', callback_data: 'provider_BTS' }],
          [{ text: 'EMU Express', callback_data: 'provider_EMU' }],
          [{ text: 'UzPost (O\'zbekiston Pochtasi)', callback_data: 'provider_UZPOST' }]
        ]
      });
      return res.status(200).json({ ok: true });
    }

  } catch (err) {
    console.error('Webhook error:', err);
  }

  return res.status(200).json({ ok: true });
}
