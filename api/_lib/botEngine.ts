import { getSupabase } from './supabase.ts';
import { STATUS_MESSAGES, sendTelegramMessage } from './botNotifications.ts';

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://yukla-go.vercel.app';

export interface BotUser {
  id: string;
  telegramUserId: number;
  customerCode: string;
  name: string;
  phone: string;
  onboardingCompleted: boolean;
  onboardingStep: 'oferta' | 'phone' | 'name' | 'provider' | 'region' | 'branch' | 'completed';
  selectedProvider?: string;
  selectedRegion?: string;
  defaultBranch?: {
    provider: string;
    branchName: string;
    region: string;
    address: string;
  };
}

// In-memory user state for dev fallback or when database is connecting
const inMemoryUsers = new Map<number, BotUser>();
let nextCustomerCodeNum = 100;

const DEV_BRANCHES = [
  { id: 'b_1', provider: 'BTS', branchName: 'BTS Chorsu', region: 'Namangan', address: 'Namangan sh., Chorsu dahasi, 12-uy' },
  { id: 'b_2', provider: 'BTS', branchName: 'BTS Chilonzor', region: 'Toshkent', address: 'Chilonzor 9-mavze, Qatortol 1' },
  { id: 'b_3', provider: 'BTS', branchName: 'BTS Samarqand Markaz', region: 'Samarqand', address: 'Mirzo Ulug\'bek ko\'chasi 45' },
  { id: 'b_4', provider: 'EMU', branchName: 'EMU Yunusobod', region: 'Toshkent', address: 'Yunusobod 4-mavze, 15-uy' },
  { id: 'b_5', provider: 'EMU', branchName: 'EMU Chortoq', region: 'Namangan', address: 'Mustaqillik ko\'chasi 10' },
  { id: 'b_6', provider: 'UZPOST', branchName: 'Bosh Pochtampt', region: 'Toshkent', address: 'Shahrisabz ko\'chasi 7' },
];

export const getMainKeyboard = () => ({
  keyboard: [
    [{ text: '📦 Yukla Go ilovasi', web_app: { url: MINI_APP_URL } }],
    [{ text: '🇨🇳 Xitoy manzili' }, { text: '🔍 Trek tekshirish' }],
    [{ text: '👤 Mening profilim' }, { text: '☎️ Yordam' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
});

export async function processTelegramUpdate(update: any): Promise<boolean> {
  const message = update.message;
  const callbackQuery = update.callback_query;
  const from = message?.from || callbackQuery?.from;
  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;

  if (!from || !chatId) return false;

  const telegramUserId = from.id;
  const supabase = getSupabase();

  // If Supabase is connected, load user from DB
  let dbUser: any = null;
  if (supabase) {
    const { data } = await supabase
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
    dbUser = data;

    if (dbUser?.status === 'blocked') {
      await sendTelegramMessage(chatId, '❌ Sizning hisobingiz bloklangan. Iltimos, admin bilan bog\'laning: @yuklago_support');
      return true;
    }
  }

  // Get or initialize in-memory fallback user
  let localUser = inMemoryUsers.get(telegramUserId);
  if (!localUser) {
    localUser = {
      id: `usr_mem_${telegramUserId}`,
      telegramUserId,
      customerCode: `YK-${nextCustomerCodeNum++}`,
      name: from.first_name || 'Mijoz',
      phone: '',
      onboardingCompleted: false,
      onboardingStep: 'oferta',
    };
    inMemoryUsers.set(telegramUserId, localUser);
  }

  const isCompleted = dbUser ? dbUser.onboarding_completed : localUser.onboardingCompleted;
  const customerCode = dbUser ? dbUser.customer_code : localUser.customerCode;
  const userName = dbUser ? dbUser.name : localUser.name;
  const userBranch = dbUser ? (dbUser as any).default_branch : localUser.defaultBranch;

  // ---------------------------------------------------------------------------
  // 1. Handle Callback Queries (Buttons)
  // ---------------------------------------------------------------------------
  if (callbackQuery) {
    const data = callbackQuery.data;

    // Oferta Accept
    if (data === 'oferta_accept') {
      localUser.onboardingStep = 'phone';
      if (supabase) {
        const { data: activeOferta } = await supabase
          .from('oferta_versions')
          .select('id')
          .eq('is_active', true)
          .single();

        if (!dbUser) {
          const { data: created } = await supabase
            .from('users')
            .insert({
              telegram_user_id: telegramUserId,
              name: from.first_name || 'Mijoz',
              phone: 'pending',
              onboarding_step: 'phone',
            })
            .select()
            .single();
          dbUser = created;
        } else {
          await supabase.from('users').update({ onboarding_step: 'phone' }).eq('id', dbUser.id);
        }

        if (dbUser && activeOferta) {
          await supabase.from('oferta_acceptances').insert({
            user_id: dbUser.id,
            telegram_user_id: telegramUserId,
            oferta_version_id: activeOferta.id,
          });
        }
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
      return true;
    }

    if (data === 'oferta_decline') {
      await sendTelegramMessage(chatId, '❌ Siz ofertani qabul qilmadingiz. Yukla Go xizmatidan foydalanish uchun ofertaga rozilik berish zarur.');
      return true;
    }

    // Provider selection
    if (data?.startsWith('provider_')) {
      const provider = data.replace('provider_', '');
      localUser.selectedProvider = provider;
      localUser.onboardingStep = 'region';

      let regions: string[] = [];
      if (supabase) {
        await supabase.from('users').update({ onboarding_step: 'region' }).eq('id', dbUser?.id);
        const { data: branches } = await supabase
          .from('delivery_branches')
          .select('region')
          .eq('provider', provider)
          .eq('active', true);
        regions = Array.from(new Set(branches?.map(b => b.region) || []));
      } else {
        regions = Array.from(new Set(DEV_BRANCHES.filter(b => b.provider === provider).map(b => b.region)));
      }

      const buttons = regions.map(reg => [{ text: reg, callback_data: `region_${provider}_${reg}` }]);
      await sendTelegramMessage(chatId, `📍 <b>${provider}</b> uchun viloyatingizni tanlang:`, { inline_keyboard: buttons });
      return true;
    }

    // Region selection
    if (data?.startsWith('region_')) {
      const [, provider, region] = data.split('_');
      localUser.selectedRegion = region;
      localUser.onboardingStep = 'branch';

      let branchesList: any[] = [];
      if (supabase) {
        await supabase.from('users').update({ onboarding_step: 'branch' }).eq('id', dbUser?.id);
        const { data: branches } = await supabase
          .from('delivery_branches')
          .select('id, branch_name')
          .eq('provider', provider)
          .eq('region', region)
          .eq('active', true);
        branchesList = branches || [];
      } else {
        branchesList = DEV_BRANCHES.filter(b => b.provider === provider && b.region === region).map(b => ({
          id: b.id,
          branch_name: b.branchName,
        }));
      }

      const buttons = branchesList.map(b => [{ text: b.branch_name, callback_data: `branch_${b.id}` }]);
      await sendTelegramMessage(chatId, `🏢 O'zingizga yaqin filialni tanlang:`, { inline_keyboard: buttons });
      return true;
    }

    // Branch selection -> Complete Onboarding!
    if (data?.startsWith('branch_')) {
      const branchId = data.replace('branch_', '');
      let chosenBranch: any = DEV_BRANCHES.find(b => b.id === branchId) || DEV_BRANCHES[0];

      if (supabase && dbUser) {
        const { data: updated } = await supabase
          .from('users')
          .update({
            default_delivery_branch_id: branchId,
            onboarding_completed: true,
            onboarding_step: 'completed',
          })
          .eq('id', dbUser.id)
          .select(`
            customer_code,
            name,
            default_branch:default_delivery_branch_id (provider, branch_name, region, address)
          `)
          .single();
        if (updated) {
          dbUser = updated;
          chosenBranch = (updated as any).default_branch;
        }
      }

      localUser.onboardingCompleted = true;
      localUser.onboardingStep = 'completed';
      localUser.defaultBranch = {
        provider: chosenBranch.provider,
        branchName: chosenBranch.branch_name || chosenBranch.branchName,
        region: chosenBranch.region,
        address: chosenBranch.address,
      };

      await sendTelegramMessage(
        chatId,
        `🎉 <b>Tabriklaymiz, ro'yxatdan o'tish muvaffaqiyatli yakunlandi!</b>\n\n` +
        `👤 Sizning mijoz kodingiz: <code>${customerCode}</code>\n` +
        `📍 Tanlangan filial: <b>${localUser.defaultBranch.provider} — ${localUser.defaultBranch.branchName} (${localUser.defaultBranch.region})</b>\n\n` +
        `Xitoy saytlarida (Taobao, 1688, Pinduoduo) xarid qilish uchun ombor manzilingiz:`,
        getMainKeyboard()
      );

      await sendWarehouseAddress(chatId, customerCode, supabase);
      return true;
    }

    // Quick add track
    if (data?.startsWith('add_track_')) {
      const trackToAdd = data.replace('add_track_', '').toUpperCase();
      let success = true;
      if (supabase && dbUser) {
        success = await addParcelToDatabase(dbUser, trackToAdd, supabase);
      }
      if (success) {
        await sendTelegramMessage(chatId, `✅ <code>${trackToAdd}</code> trek raqami hisobingizga muvaffaqiyatli qo'shildi!`);
      } else {
        await sendTelegramMessage(chatId, `⚠️ Ushbu trek raqam allaqachon ro'yxatdan o'tgan.`);
      }
      return true;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Handle Incoming Messages
  // ---------------------------------------------------------------------------
  const rawText = message?.text?.trim() || '';
  const textLower = rawText.toLowerCase();

  // Contact Sharing
  if (message?.contact) {
    const contact = message.contact;

    // Strict Anti-Spoofing Check
    if (contact.user_id && contact.user_id !== telegramUserId) {
      await sendTelegramMessage(
        chatId,
        '⚠️ <b>Xavfsizlik ogohlantirishi:</b>\nIltimos, faqat o\'zingizning shaxsiy telefon raqamingizni yuboring!'
      );
      return true;
    }

    let phone = contact.phone_number;
    if (!phone.startsWith('+')) phone = '+' + phone;

    localUser.phone = phone;
    localUser.onboardingStep = 'name';

    if (supabase && dbUser) {
      await supabase.from('users').update({
        phone,
        phone_verified_at: new Date().toISOString(),
        onboarding_step: 'name',
      }).eq('id', dbUser.id);
    }

    await sendTelegramMessage(
      chatId,
      `✅ Telefon raqamingiz qabul qilindi: <b>${phone}</b>\n\n` +
      `Endi ism va familiyangizni kiriting:\n<i>(Masalan: Saidislom Karimiy)</i>`,
      { remove_keyboard: true }
    );
    return true;
  }

  // Name Input Step
  const currentStep = dbUser ? dbUser.onboarding_step : localUser.onboardingStep;
  if (currentStep === 'name' && rawText && !rawText.startsWith('/')) {
    if (rawText.length < 3 || rawText.length > 60) {
      await sendTelegramMessage(chatId, 'Iltimos, to\'liq ismingizni kiriting (3 tadan 60 tagacha belgi):');
      return true;
    }

    localUser.name = rawText;
    localUser.onboardingStep = 'provider';

    if (supabase && dbUser) {
      await supabase.from('users').update({
        name: rawText,
        onboarding_step: 'provider',
      }).eq('id', dbUser.id);
    }

    await sendTelegramMessage(chatId, `Rahmat, <b>${rawText}</b>!\nYetkazib berish xizmatini tanlang:`, {
      inline_keyboard: [
        [{ text: 'BTS Pochta', callback_data: 'provider_BTS' }],
        [{ text: 'EMU Express', callback_data: 'provider_EMU' }],
        [{ text: 'UzPost (O\'zbekiston Pochtasi)', callback_data: 'provider_UZPOST' }],
      ],
    });
    return true;
  }

  // New User /start flow
  if (!isCompleted) {
    if (rawText === '/start') {
      await sendTelegramMessage(
        chatId,
        `Assalomu alaykum! <b>Yukla Go</b> kargo xizmatiga xush kelibsiz.\n\n` +
        `Ro'yxatdan o'tishdan oldin Ommaviy Oferta shartlari bilan tanishib chiqing:\n\n` +
        `<i>1. Yukla Go xizmati Xitoydan O'zbekistonga yuklarni havo yo'li orqali yetkazib beradi.\n` +
        `2. Akkumulyator, magnit, suyuqlik va yonuvchan moddalar jo'natish qat'iyan taqiqlanadi.\n` +
        `3. Yuk yetib kelgach, uning haqiqiy og'irligiga ko'ra to'lov qilinadi.</i>`,
        {
          inline_keyboard: [
            [
              { text: '✅ Roziman', callback_data: 'oferta_accept' },
              { text: '❌ Rozimasman', callback_data: 'oferta_decline' },
            ],
          ],
        }
      );
      return true;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Completed User Commands & Navigation
  // ---------------------------------------------------------------------------
  if (isCompleted) {
    // /start
    if (rawText === '/start') {
      const branchDisplay = userBranch
        ? `${userBranch.provider || 'BTS'} — ${userBranch.branch_name || userBranch.branchName || 'Markaziy'}`
        : 'BTS — Chorsu';

      await sendTelegramMessage(
        chatId,
        `Assalomu alaykum, <b>${userName}</b>!\n\n` +
        `👤 Mijoz kodingiz: <code>${customerCode}</code>\n` +
        `📍 Filialingiz: <b>${branchDisplay}</b>\n\n` +
        `Quyidagi menyu orqali amallarni bajarishingiz mumkin:`,
        getMainKeyboard()
      );
      return true;
    }

    // China Warehouse Address
    if (textLower === '/address' || textLower === '/manzil' || textLower === '🇨🇳 xitoy manzili') {
      await sendWarehouseAddress(chatId, customerCode, supabase);
      return true;
    }

    // Profile & ID
    if (textLower === '/myid' || textLower === '/id' || textLower === '/kod' || textLower === '👤 mening profilim') {
      const phoneDisplay = dbUser?.phone || localUser.phone || '+998 90 123 45 67';
      const branchDisplay = userBranch
        ? `${userBranch.provider || 'BTS'} — ${userBranch.branch_name || userBranch.branchName || ''}`
        : 'BTS — Chorsu';

      await sendTelegramMessage(
        chatId,
        `👤 <b>Mening Profilim:</b>\n\n` +
        `Mijoz kodi: <code>${customerCode}</code>\n` +
        `F.I.SH: <b>${userName}</b>\n` +
        `Telefon: <code>${phoneDisplay}</code>\n` +
        `Yetkazib berish filiali: <b>${branchDisplay}</b>\n\n` +
        `Filialni o'zgartirish uchun ilovadagi "Profil" bo'limiga kiring:`,
        {
          inline_keyboard: [
            [{ text: '📦 Yukla Go ilovasini ochish', web_app: { url: MINI_APP_URL } }],
          ],
        }
      );
      return true;
    }

    // Rate Calculator
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
      return true;
    }

    // Help
    if (textLower === '/help' || textLower === '/yordam' || textLower === '☎️ yordam') {
      await sendTelegramMessage(
        chatId,
        `❓ <b>Qanday foydalaniladi?</b>\n\n` +
        `1️⃣ <b>Xitoy manzilini oling:</b> <code>/address</code> orqali ombor manzilini ko'ring.\n` +
        `2️⃣ <b>Xarid qiling:</b> Taobao, 1688 yoki Pinduoduo ilovalarida manzilga o'z kodingizni (<code>${customerCode}</code>) kiriting.\n` +
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
      return true;
    }

    // Search Tracking Input
    if (textLower === '🔍 trek tekshirish') {
      await sendTelegramMessage(chatId, `🔍 Trek raqamini tekshirish uchun uni botga yuboring:\n<i>(Masalan: YT882910291CN)</i>`);
      return true;
    }

    let trackingInput = rawText;
    if (trackingInput.startsWith('/track')) {
      trackingInput = trackingInput.replace('/track', '').trim();
    }

    if (trackingInput && /^[a-zA-Z0-9]{8,35}$/.test(trackingInput)) {
      const cleanTrack = trackingInput.toUpperCase();

      let foundParcel: any = null;
      if (supabase) {
        const { data } = await supabase
          .from('parcels')
          .select('id, tracking_number, status, payment_status, amount, weight_kg, delivery_address_snapshot')
          .eq('tracking_number', cleanTrack)
          .single();
        foundParcel = data;
      }

      if (foundParcel) {
        const statusInfo = STATUS_MESSAGES[foundParcel.status] || { title: foundParcel.status, desc: '' };
        const weight = foundParcel.weight_kg ? `${foundParcel.weight_kg} kg` : 'Kutilmoqda';
        const amount = foundParcel.amount ? `$${Number(foundParcel.amount).toFixed(2)}` : 'Aniqlanmoqda';
        const branchSnap = foundParcel.delivery_address_snapshot;

        await sendTelegramMessage(
          chatId,
          `📦 <b>Yuk ma'lumotlari:</b>\n\n` +
          `Trek raqam: <code>${foundParcel.tracking_number}</code>\n` +
          `Holati: <b>${statusInfo.title}</b>\n` +
          `Vazni: <b>${weight}</b>\n` +
          `Narxi: <b>${amount}</b>\n` +
          `To'lov holati: <b>${foundParcel.payment_status === 'paid' ? '✅ To\'langan' : '⏳ To\'lov kutilmoqda'}</b>\n` +
          (branchSnap ? `Filial: <b>${branchSnap.provider} — ${branchSnap.branchName}</b>\n` : '') +
          `\n${statusInfo.desc}`,
          {
            inline_keyboard: [
              [{ text: '📦 Yukla Go ilovasida ko\'rish', web_app: { url: MINI_APP_URL } }],
            ],
          }
        );
      } else {
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
      return true;
    }

    // Default reply
    await sendTelegramMessage(
      chatId,
      `Buyruq tushunarsiz bo'ldi. Trek raqamini yuboring yoki quyidagi menyudan foydalaning:`,
      getMainKeyboard()
    );
    return true;
  }

  return true;
}

// -----------------------------------------------------------------------------
// Helper: Send formatted China Warehouse Address
// -----------------------------------------------------------------------------
async function sendWarehouseAddress(chatId: number, customerCode: string, supabase: any) {
  let receiver = `Yukla Go (${customerCode})`;
  let phone = '13335957161';
  let region = '浙江省金华市义乌市';
  let address = `077库房/70099号 ${customerCode}`;

  if (supabase) {
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
// Helper: Add Parcel to Database
// -----------------------------------------------------------------------------
async function addParcelToDatabase(user: any, trackingNumber: string, supabase: any): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from('parcels')
      .select('id')
      .eq('tracking_number', trackingNumber)
      .single();

    if (existing) return false;

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
