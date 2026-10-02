import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../_lib/supabase';
import { STATUS_MESSAGES } from '../_lib/botNotifications';

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

// Reusable main keyboard for registered users
const getMainKeyboard = () => ({
  keyboard: [
    [{ text: '📦 Yukla Go ilovasi', web_app: { url: MINI_APP_URL } }],
    [{ text: '🇨🇳 Xitoy manzili' }, { text: '🔍 Trek tekshirish' }],
    [{ text: '👤 Mening profilim' }, { text: '☎️ Yordam' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
});

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
    // Development fallback greeting
    await sendTelegramMessage(
      chatId,
      `Assalomu alaykum, <b>${from.first_name}</b>!\n\n` +
      `<b>Yukla Go</b> xizmatiga xush kelibsiz. Bot tez orada to'liq ishga tushadi.\n` +
      `Ilovani sinab ko'rish uchun quyidagi tugmani bosing:`,
      {
        inline_keyboard: [[{ text: '📦 Yukla Go ilovasini ochish', web_app: { url: MINI_APP_URL } }]],
      }
    );
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
        default_branch:default_delivery_branch_id (provider, branch_name, region, address)
      `)
      .eq('telegram_user_id', telegramUserId)
      .single();

    // 2. Handle Blocked Users
    if (user?.status === 'blocked') {
      await sendTelegramMessage(chatId, '❌ Sizning hisobingiz bloklangan. Iltimos, ma\'muriyat bilan bog\'laning: @yuklago_support');
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
          '✅ Oferta shartlarini qabul qildingiz.\n\n' +
          'Iltimos, telefon raqamingizni tasdiqlash uchun pastdagi <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosing:',
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
          `👤 Sizning mijoz kodingiz: <code>${updatedUser?.customer_code}</code>\n` +
          `📍 Tanlangan filial: <b>${branch?.provider} — ${branch?.branch_name} (${branch?.region})</b>\n\n` +
          `Xitoy saytlarida (Taobao, 1688, Pinduoduo) xarid qilish uchun ombor manzilingizni olishingiz mumkin:`,
          getMainKeyboard()
        );

        // Also prompt China warehouse address immediately
        await sendWarehouseAddress(chatId, updatedUser?.customer_code || 'YK-100', supabase);
        return res.status(200).json({ ok: true });
      }

      // Quick add track callback
      if (data?.startsWith('add_track_') && user) {
        const trackToAdd = data.replace('add_track_', '').toUpperCase();
        const success = await addParcelDirectly(user, trackToAdd, supabase);
        if (success) {
          await sendTelegramMessage(chatId, `✅ <code>${trackToAdd}</code> trek raqami hisobingizga muvaffaqiyatli qo'shildi!`);
        } else {
          await sendTelegramMessage(chatId, `⚠️ Ushbu trek raqam allaqachon tizimda mavjud.`);
        }
        return res.status(200).json({ ok: true });
      }
    }

    // 4. Handle Incoming Messages
    const rawText = message?.text?.trim() || '';
    const textLower = rawText.toLowerCase();

    // Secure Phone Verification Check
    if (message?.contact) {
      const contact = message.contact;

      // Strict security rule: Prevent users from sharing another person's contact
      if (contact.user_id && contact.user_id !== telegramUserId) {
        await sendTelegramMessage(
          chatId,
          '⚠️ <b>Xavfsizlik ogohlantirishi:</b>\nIltimos, faqat o\'zingizning shaxsiy telefon raqamingizni yuboring!'
        );
        return res.status(200).json({ ok: true });
      }

      let phone = contact.phone_number;
      if (!phone.startsWith('+')) phone = '+' + phone;

      if (user) {
        await supabase.from('users').update({
          phone,
          phone_verified_at: new Date().toISOString(),
          onboarding_step: 'name',
        }).eq('id', user.id);
      }

      await sendTelegramMessage(
        chatId,
        `✅ Telefon raqamingiz qabul qilindi: <b>${phone}</b>\n\n` +
        `Endi ism va familiyangizni kiriting:\n<i>(Masalan: Saidislom Karimiy)</i>`,
        { remove_keyboard: true }
      );
      return res.status(200).json({ ok: true });
    }

    // Name Step in Onboarding
    if (user && user.onboarding_step === 'name' && rawText && !rawText.startsWith('/')) {
      if (rawText.length < 3 || rawText.length > 60) {
        await sendTelegramMessage(chatId, 'Iltimos, to\'liq ismingizni kiriting (3 tadan 60 tagacha belgi):');
        return res.status(200).json({ ok: true });
      }

      await supabase.from('users').update({
        name: rawText,
        onboarding_step: 'provider',
      }).eq('id', user.id);

      await sendTelegramMessage(chatId, `Rahmat, <b>${rawText}</b>!\nYetkazib berish xizmatini tanlang:`, {
        inline_keyboard: [
          [{ text: 'BTS Pochta', callback_data: 'provider_BTS' }],
          [{ text: 'EMU Express', callback_data: 'provider_EMU' }],
          [{ text: 'UzPost (O\'zbekiston Pochtasi)', callback_data: 'provider_UZPOST' }],
        ],
      });
      return res.status(200).json({ ok: true });
    }

    // New / Non-onboarded user /start flow
    if (!user || !user.onboarding_completed) {
      if (rawText === '/start') {
        await sendTelegramMessage(
          chatId,
          `Assalomu alaykum! <b>Yukla Go</b> kargo xizmatiga xush kelibsiz.\n\n` +
          `Ro'yxatdan o'tishdan oldin Ommaviy Oferta shartlari bilan tanishib chiqing:\n\n` +
          `<i>1. Yukla Go xizmati Xitoydan O'zbekistonga yuklarni havo yo'li orqali yetkazib beradi.\n` +
          `2. Akkumulyator, magnit, suyuqlik va yonuvchan moddalar jo'natish taqiqlanadi.\n` +
          `3. Yuk kelgach, uning haqiqiy og'irligiga ko'ra to'lov qilinadi.</i>`,
          {
            inline_keyboard: [
              [
                { text: '✅ Roziman', callback_data: 'oferta_accept' },
                { text: '❌ Rozimasman', callback_data: 'oferta_decline' },
              ],
            ],
          }
        );
        return res.status(200).json({ ok: true });
      }
    }

    // -------------------------------------------------------------
    // REGISTERED USER HANDLERS
    // -------------------------------------------------------------
    if (user && user.onboarding_completed) {
      const branch = (user as any)?.default_branch;

      // 1. /start or greeting
      if (rawText === '/start') {
        await sendTelegramMessage(
          chatId,
          `Assalomu alaykum, <b>${user.name}</b>!\n\n` +
          `👤 Mijoz kodingiz: <code>${user.customer_code}</code>\n` +
          `📍 Filialingiz: <b>${branch?.provider || 'BTS'} — ${branch?.branch_name || 'Markaziy'}</b>\n\n` +
          `Quyidagi menyu orqali amallarni bajarishingiz mumkin:`,
          getMainKeyboard()
        );
        return res.status(200).json({ ok: true });
      }

      // 2. China Warehouse Address (/address, /manzil, or keyboard button)
      if (textLower === '/address' || textLower === '/manzil' || textLower === '🇨🇳 xitoy manzili') {
        await sendWarehouseAddress(chatId, user.customer_code, supabase);
        return res.status(200).json({ ok: true });
      }

      // 3. Customer Profile & ID (/myid, /id, /kod, or keyboard button)
      if (textLower === '/myid' || textLower === '/id' || textLower === '/kod' || textLower === '👤 mening profilim') {
        await sendTelegramMessage(
          chatId,
          `👤 <b>Mening Profilim:</b>\n\n` +
          `Mijoz kodi: <code>${user.customer_code}</code>\n` +
          `F.I.SH: <b>${user.name}</b>\n` +
          `Telefon: <code>${user.phone}</code>\n` +
          `Yetkazib berish filiali: <b>${branch?.provider || 'BTS'} — ${branch?.branch_name || ''}</b>\n` +
          `Manzil: <i>${branch?.region || ''}, ${branch?.address || ''}</i>\n\n` +
          `Filialni o'zgartirish uchun ilovadagi "Profil" bo'limiga kiring:`,
          {
            inline_keyboard: [
              [{ text: '📦 Yukla Go ilovasini ochish', web_app: { url: MINI_APP_URL } }],
            ],
          }
        );
        return res.status(200).json({ ok: true });
      }

      // 4. Rate Calculator Guide (/calculator, /kalkulyator)
      if (textLower === '/calculator' || textLower === '/kalkulyator') {
        await sendTelegramMessage(
          chatId,
          `🧮 <b>Yetkazib berish narxini hisoblash:</b>\n\n` +
          `✈️ Aviatarif: <b>$9.5 / kg</b>\n` +
          `💵 Amaldagi kurs: <b>1 USD = 12,850 UZS</b>\n\n` +
          `Aniq hisob-kitob qilish uchun Yukla Go ilovasidagi kalkulyatordan foydalaning:`,
          {
            inline_keyboard: [
              [{ text: '🧮 Kalkulyatorni ochish', web_app: { url: MINI_APP_URL } }],
            ],
          }
        );
        return res.status(200).json({ ok: true });
      }

      // 5. Help Guide (/help, /yordam, or keyboard button)
      if (textLower === '/help' || textLower === '/yordam' || textLower === '☎️ yordam') {
        await sendTelegramMessage(
          chatId,
          `❓ <b>Qanday foydalaniladi?</b>\n\n` +
          `1️⃣ <b>Xitoy manzilini oling:</b> <code>/address</code> buyrug'i orqali ombor manzilini ko'ring.\n` +
          `2️⃣ <b>Xarid qiling:</b> Taobao, 1688 yoki Pinduoduo ilovalarida manzilga o'z kodingizni (<code>${user.customer_code}</code>) kiriting.\n` +
          `3️⃣ <b>Trekni kiriting:</b> Buyurtma jo'natilgach, berilgan trek kodini botga yuboring yoki ilovaga qo'shing.\n` +
          `4️⃣ <b>Kuzatib boring:</b> Yukingiz O'zbekistonga yetib kelguncha bot orqali avtomatik bildirishnoma olasiz.\n\n` +
          `Savollaringiz bormi? Admin: @yuklago_support`,
          {
            inline_keyboard: [
              [{ text: '☎️ Admin bilan bog\'lanish', url: 'https://t.me/yuklago_support' }],
              [{ text: '📦 Ilovani ochish', web_app: { url: MINI_APP_URL } }],
            ],
          }
        );
        return res.status(200).json({ ok: true });
      }

      // 6. Direct Tracking Check / Track input
      if (textLower === '🔍 trek tekshirish') {
        await sendTelegramMessage(
          chatId,
          `🔍 Trek raqamini tekshirish uchun uni botga yuboring:\n<i>(Masalan: YT882910291CN)</i>`
        );
        return res.status(200).json({ ok: true });
      }

      // Handle /track <number> or raw tracking number
      let trackingInput = rawText;
      if (trackingInput.startsWith('/track')) {
        trackingInput = trackingInput.replace('/track', '').trim();
      }

      if (trackingInput && /^[a-zA-Z0-9]{8,35}$/.test(trackingInput)) {
        const cleanTrack = trackingInput.toUpperCase();

        // Search in parcels
        const { data: parcel } = await supabase
          .from('parcels')
          .select(`
            id,
            tracking_number,
            status,
            payment_status,
            amount,
            weight_kg,
            delivery_address_snapshot,
            created_at
          `)
          .eq('tracking_number', cleanTrack)
          .single();

        if (parcel) {
          const statusInfo = STATUS_MESSAGES[parcel.status] || { title: parcel.status, desc: '' };
          const weight = parcel.weight_kg ? `${parcel.weight_kg} kg` : 'Kutilmoqda';
          const amount = parcel.amount ? `$${Number(parcel.amount).toFixed(2)}` : 'Aniqlanmoqda';
          const branchSnap = parcel.delivery_address_snapshot;

          await sendTelegramMessage(
            chatId,
            `📦 <b>Yuk ma'lumotlari:</b>\n\n` +
            `Trek raqam: <code>${parcel.tracking_number}</code>\n` +
            `Holati: <b>${statusInfo.title}</b>\n` +
            `Vazni: <b>${weight}</b>\n` +
            `Narxi: <b>${amount}</b>\n` +
            `To'lov holati: <b>${parcel.payment_status === 'paid' ? '✅ To\'langan' : '⏳ To\'lov kutilmoqda'}</b>\n` +
            (branchSnap ? `Filial: <b>${branchSnap.provider} — ${branchSnap.branchName}</b>\n` : '') +
            `\n${statusInfo.desc}`,
            {
              inline_keyboard: [
                [{ text: '📦 Yukla Go ilovasida ko\'rish', web_app: { url: MINI_APP_URL } }],
              ],
            }
          );
        } else {
          // Track not found in database, offer quick add
          await sendTelegramMessage(
            chatId,
            `🔎 <code>${cleanTrack}</code> trek raqami bo'yicha ma'lumot topilmadi.\n\n` +
            `Uni hisobingizga qo'shishni xohlaysizmi?`,
            {
              inline_keyboard: [
                [{ text: `➕ Ha, yuklarimga qo'shish`, callback_data: `add_track_${cleanTrack}` }],
              ],
            }
          );
        }
        return res.status(200).json({ ok: true });
      }

      // Default fallback response
      await sendTelegramMessage(
        chatId,
        `Buyruq tushunarsiz bo'ldi. Trek raqamini yuboring yoki quyidagi menyudan foydalaning:`,
        getMainKeyboard()
      );
      return res.status(200).json({ ok: true });
    }

  } catch (err) {
    console.error('Webhook error:', err);
  }

  return res.status(200).json({ ok: true });
}

// -----------------------------------------------------------------------------
// Helper: Send formatted China Warehouse Address
// -----------------------------------------------------------------------------
async function sendWarehouseAddress(chatId: number, customerCode: string, supabase: any) {
  let receiver = `Yukla Go (${customerCode})`;
  let phone = '13335957161';
  let region = '浙江省金华市义乌市';
  let address = `077库房/70099号 ${customerCode}`;

  try {
    const { data: provider } = await supabase
      .from('cargo_providers')
      .select('phone, province, city, district, full_address, warehouse_code, address_template')
      .eq('active', true)
      .single();

    if (provider) {
      phone = provider.phone;
      region = `${provider.province} ${provider.city}${provider.district ? ' ' + provider.district : ''}`;
      address = provider.address_template
        .replace('{warehouse_code}', provider.warehouse_code)
        .replace('{customer_id}', customerCode);
    }
  } catch {
    // Keep defaults
  }

  const message =
    `🇨🇳 <b>Xitoydagi ombor manzilingiz:</b>\n\n` +
    `👤 <b>Qabul qiluvchi (收件人):</b>\n<code>${receiver}</code>\n\n` +
    `📱 <b>Telefon (手机号码):</b>\n<code>${phone}</code>\n\n` +
    `📍 <b>Hudud (所在地区):</b>\n<code>${region}</code>\n\n` +
    `🏢 <b>Batafsil manzil (详细地址):</b>\n<code>${address}</code>\n\n` +
    `💡 <i>Nusxalash uchun matn ustiga bosing. Taobao / 1688 / Pinduoduo ilovalarida manzil sifatida kiriting.</i>`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '📦 Yukla Go ilovasini ochish', web_app: { url: MINI_APP_URL } }],
    ],
  };

  await sendTelegramMessage(chatId, message, keyboard);
}

// -----------------------------------------------------------------------------
// Helper: Directly Add Parcel via Telegram Chat
// -----------------------------------------------------------------------------
async function addParcelDirectly(user: any, trackingNumber: string, supabase: any): Promise<boolean> {
  try {
    // Check if track exists
    const { data: existing } = await supabase
      .from('parcels')
      .select('id')
      .eq('tracking_number', trackingNumber)
      .single();

    if (existing) return false;

    // Fetch active provider snapshot
    const { data: activeProvider } = await supabase
      .from('cargo_providers')
      .select('id, phone, province, city, district, full_address, warehouse_code')
      .eq('active', true)
      .single();

    const branch = user.default_branch;
    const deliverySnapshot = branch ? {
      provider: branch.provider,
      branchName: branch.branch_name,
      region: branch.region,
      address: branch.address,
    } : {
      provider: 'Standard',
      branchName: 'Standart filial',
      region: 'O\'zbekiston',
      address: 'Markaziy ombor',
    };

    const cargoSnapshot = activeProvider ? {
      warehouseCode: activeProvider.warehouse_code,
      fullAddress: `${activeProvider.province} ${activeProvider.city} ${activeProvider.full_address}`,
      phone: activeProvider.phone,
    } : {
      warehouseCode: '077库房',
      fullAddress: 'Zhejiang Jinhua Yiwu',
      phone: '13335957161',
    };

    const { data: newParcel, error } = await supabase
      .from('parcels')
      .insert({
        user_id: user.id,
        tracking_number: trackingNumber,
        customer_code_snapshot: user.customer_code,
        cargo_provider_id: activeProvider?.id || null,
        cargo_address_snapshot: cargoSnapshot,
        delivery_branch_id: user.default_delivery_branch_id || null,
        delivery_address_snapshot: deliverySnapshot,
        status: 'added',
        payment_status: 'pending',
        amount: 0,
        currency: 'USD',
        weight_kg: 0,
      })
      .select()
      .single();

    return !error && !!newParcel;
  } catch {
    return false;
  }
}
