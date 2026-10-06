import { getSupabase } from './supabase.ts';
import { ADMIN_TELEGRAM_IDS as AUTH_ADMIN_IDS } from './auth.ts';
import { STATUS_MESSAGES, sendTelegramMessage } from './botNotifications.ts';
import { ALL_BRANCHES, REGIONS_LIST, getBranches, getRegionsForProvider, findBranchById } from './branchesData.ts';
import { getOfertaText } from './ofertaData.ts';

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://yuklago.vercel.app';

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

/**
 * Wipes all bot history, session, and state for a Telegram user so they start 100% fresh
 */
export function wipeBotUser(identifier: string | number): { success: boolean; wipedUser?: BotUser } {
  const numericId = typeof identifier === 'number' ? identifier : Number(identifier);
  let wipedUser: BotUser | undefined;

  if (!isNaN(numericId) && inMemoryUsers.has(numericId)) {
    wipedUser = inMemoryUsers.get(numericId);
    inMemoryUsers.delete(numericId);
    return { success: true, wipedUser };
  }

  const clean = String(identifier).trim().toUpperCase();
  for (const [tgId, user] of inMemoryUsers.entries()) {
    if (
      user.id === identifier ||
      user.customerCode.toUpperCase() === clean ||
      String(user.telegramUserId) === clean ||
      (user.name && user.name.toUpperCase().includes(clean))
    ) {
      wipedUser = user;
      inMemoryUsers.delete(tgId);
      return { success: true, wipedUser };
    }
  }

  return { success: false };
}

/**
 * Get all active in-memory bot users
 */
export function getInMemoryBotUsers(): BotUser[] {
  return Array.from(inMemoryUsers.values());
}

export const ADMIN_TELEGRAM_IDS: number[] = AUTH_ADMIN_IDS;

export const getAdminInlineKeyboard = () => {
  return {
    inline_keyboard: [
      [{ text: '⚙️ Admin Dashboard', web_app: { url: `${MINI_APP_URL}#admin` } }],
      [{ text: '🎓 Video darslar', web_app: { url: MINI_APP_URL } }],
      [{ text: '👤 Mening profilim', callback_data: 'cmd_profile' }],
      [{ text: '🇨🇳 Xitoy manzili', callback_data: 'cmd_address' }, { text: '☎️ Yordam', callback_data: 'cmd_help' }],
    ],
  };
};

export const getMainInlineKeyboard = (customerCode?: string, name?: string) => {
  const query = customerCode
    ? `?code=${encodeURIComponent(customerCode)}${name ? `&name=${encodeURIComponent(name)}` : ''}`
    : '';
  const personalAppUrl = `${MINI_APP_URL}${query}`;
  const academyUrl = `${personalAppUrl}${query ? '&' : '?'}app=academy`;

  return {
    inline_keyboard: [
      [{ text: customerCode ? `📱 Shaxsiy hisobim (${customerCode})` : '📱 Shaxsiy hisobimni ochish', web_app: { url: personalAppUrl } }],
      [{ text: '🎓 Video darslar', web_app: { url: academyUrl } }],
      [{ text: '👤 Mening profilim', callback_data: 'cmd_profile' }],
      [{ text: '🇨🇳 Xitoy manzili', callback_data: 'cmd_address' }, { text: '☎️ Yordam', callback_data: 'cmd_help' }],
    ],
  };
};

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
      .maybeSingle();
    dbUser = data;

    if (dbUser?.status === 'blocked') {
      await sendTelegramMessage(chatId, '❌ Sizning hisobingiz bloklangan. Iltimos, admin bilan bog\'laning: @nothing_related');
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
  const isAdmin = ADMIN_TELEGRAM_IDS.includes(Number(telegramUserId));

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
        'Iltimos, telefon raqamingizni yozib yuboring:\n<i>(Masalan: +998901234567)</i>',
        { remove_keyboard: true }
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
      }
      if (regions.length === 0) {
        regions = getRegionsForProvider(provider);
      }

      // 2-column inline keyboard layout for mobile Telegram
      const buttons: any[][] = [];
      for (let i = 0; i < regions.length; i += 2) {
        const row: any[] = [{ text: regions[i], callback_data: `reg_${provider}_${i}` }];
        if (regions[i + 1]) {
          row.push({ text: regions[i + 1], callback_data: `reg_${provider}_${i + 1}` });
        }
        buttons.push(row);
      }

      await sendTelegramMessage(chatId, `📍 <b>${provider}</b> uchun viloyatingizni tanlang:`, { inline_keyboard: buttons });
      return true;
    }

    // Region selection
    if (data?.startsWith('reg_') || data?.startsWith('region_')) {
      let provider = '';
      let region = '';

      if (data.startsWith('reg_')) {
        const parts = data.split('_');
        provider = parts[1];
        const idx = parseInt(parts[2], 10);
        const provRegions = getRegionsForProvider(provider);
        region = provRegions[idx] || REGIONS_LIST[idx] || parts.slice(2).join('_');
      } else {
        const parts = data.split('_');
        provider = parts[1];
        region = parts.slice(2).join('_');
      }

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
      }
      if (branchesList.length === 0) {
        branchesList = getBranches(provider, region).map(b => ({
          id: b.id,
          branch_name: b.branchName,
        }));
      }

      const buttons = branchesList.map(b => [{ text: b.branch_name, callback_data: `branch_${b.id}` }]);
      await sendTelegramMessage(chatId, `🏢 <b>${region}</b> bo'yicha filialni tanlang:`, { inline_keyboard: buttons });
      return true;
    }

    // Branch selection -> Complete Onboarding!
    if (data?.startsWith('branch_')) {
      const branchId = data.replace('branch_', '');
      let chosenBranch: any = findBranchById(branchId) || ALL_BRANCHES[0];

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
        `👤 Sizning mijoz kodingiz: <code>${customerCode}</code>\n\n` +
        `Xitoy saytlarida (Taobao, 1688, Pinduoduo) xarid qilish uchun ombor manzilingiz:`,
        getMainInlineKeyboard(customerCode, dbUser?.name || localUser.name)
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

    // Inline menu callback: Profile
    if (data === 'cmd_profile') {
      const phoneDisplay = dbUser?.phone || localUser.phone || 'Kiritilmagan';
      const personalUrl = `${MINI_APP_URL}?code=${encodeURIComponent(customerCode)}&name=${encodeURIComponent(userName)}`;
      await sendTelegramMessage(
        chatId,
        `👤 <b>Mening Profilim:</b>\n\n` +
        `Mijoz kodi: <code>${customerCode}</code>\n` +
        `F.I.SH: <b>${userName}</b>\n` +
        `Telefon: <code>${phoneDisplay}</code>\n\n` +
        `📦 <i>Tovarlaringiz O'zbekistonga yetib kelgach, administrator shaxsan sizga yetkazib beradi.</i>`,
        {
          inline_keyboard: [
            [{ text: `📱 Shaxsiy hisobim (${customerCode})`, web_app: { url: personalUrl } }],
            [{ text: '🎓 Video darslar', web_app: { url: `${personalUrl}&app=academy` } }],
          ],
        }
      );
      return true;
    }

    // Inline menu callback: China warehouse address
    if (data === 'cmd_address') {
      await sendWarehouseAddress(chatId, customerCode, supabase);
      return true;
    }

    // Inline menu callback: Help
    if (data === 'cmd_help') {
      const personalUrl = `${MINI_APP_URL}?code=${encodeURIComponent(customerCode)}&name=${encodeURIComponent(userName)}`;
      await sendTelegramMessage(
        chatId,
        `❓ <b>Qanday foydalaniladi?</b>\n\n` +
        `1️⃣ <b>Xitoy manzilini oling:</b> Ombor manzilini "🇨🇳 Xitoy manzili" tugmasi orqali ko'ring.\n` +
        `2️⃣ <b>Xarid qiling:</b> Taobao, 1688 yoki Pinduoduo ilovalarida manzilga o'z kodingizni (<code>${customerCode}</code>) kiriting.\n` +
        `3️⃣ <b>Trekni kiriting:</b> Buyurtma jo'natilgach, berilgan trek kodini botga yuboring yoki ilovaga qo'shing.\n` +
        `4️⃣ <b>Kuzatib boring:</b> Yukingiz O'zbekistonga yetib kelguncha bot orqali avtomatik bildirishnoma olasiz.\n\n` +
        `Savollaringiz bormi? Admin: @nothing_related`,
        {
          inline_keyboard: [
            [{ text: '☎️ Admin bilan bog\'lanish', url: 'https://t.me/nothing_related' }],
            [{ text: `📱 Shaxsiy hisobim (${customerCode})`, web_app: { url: personalUrl } }],
          ],
        }
      );
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
      `Endi to'liq ism va familiyangizni kiriting:\n<i>(Masalan: Saidislombek Abdumalikov)</i>`,
      { remove_keyboard: true }
    );
    return true;
  }

  const currentStep = dbUser ? dbUser.onboarding_step : localUser.onboardingStep;

  // Phone Input Step (typed as text message)
  if (currentStep === 'phone' && rawText && !rawText.startsWith('/')) {
    const cleanedDigits = rawText.replace(/\D/g, '');
    let formattedPhone = '';
    if (cleanedDigits.length === 9) {
      formattedPhone = `+998${cleanedDigits}`;
    } else if (cleanedDigits.length === 12 && cleanedDigits.startsWith('998')) {
      formattedPhone = `+${cleanedDigits}`;
    } else if (cleanedDigits.length >= 7 && cleanedDigits.length <= 15) {
      formattedPhone = `+${cleanedDigits}`;
    }

    if (!formattedPhone) {
      await sendTelegramMessage(
        chatId,
        '⚠️ <b>Telefon raqam noto\'g\'ri kiritildi:</b>\nIltimos, raqamingizni to\'liq yozib yuboring:\n<i>(Masalan: +998901234567)</i>',
        { remove_keyboard: true }
      );
      return true;
    }

    localUser.phone = formattedPhone;
    localUser.onboardingStep = 'name';

    if (supabase && dbUser) {
      await supabase.from('users').update({
        phone: formattedPhone,
        phone_verified_at: new Date().toISOString(),
        onboarding_step: 'name',
      }).eq('id', dbUser.id);
    }

    await sendTelegramMessage(
      chatId,
      `✅ Telefon raqamingiz qabul qilindi: <b>${formattedPhone}</b>\n\n` +
      `Endi to'liq ism va familiyangizni kiriting:\n<i>(Masalan: Saidislombek Abdumalikov)</i>`,
      { remove_keyboard: true }
    );
    return true;
  }

  // Name Input Step -> Immediately Complete without location hurdles!
  if (currentStep === 'name' && rawText && !rawText.startsWith('/')) {
    if (rawText.length < 3 || rawText.length > 60) {
      await sendTelegramMessage(chatId, 'Iltimos, to\'liq ismingizni kiriting (3 tadan 60 tagacha belgi):');
      return true;
    }

    localUser.name = rawText;
    localUser.onboardingCompleted = true;
    localUser.onboardingStep = 'completed';

    if (supabase && dbUser) {
      await supabase.from('users').update({
        name: rawText,
        onboarding_completed: true,
        onboarding_step: 'completed',
      }).eq('id', dbUser.id);
    }

    await sendTelegramMessage(
      chatId,
      `🎉 <b>Tabriklaymiz, ${rawText}!</b>\n\n` +
      `Siz Yukla Go tizimidan muvaffaqiyatli ro'yxatdan o'tdingiz!\n` +
      `👤 Sizning shaxsiy mijoz kodingiz: <code>${customerCode}</code>\n\n` +
      `Quyidagi tugma orqali shaxsiy hisobingizga kiring:`,
      getMainInlineKeyboard(customerCode, rawText)
    );

    await sendWarehouseAddress(chatId, customerCode, supabase);
    return true;
  }

  // New User /start flow -> Oferta -> Phone -> Name -> Mini App
  if (!isCompleted) {
    if (rawText === '/start') {
      if (isAdmin) {
        localUser.onboardingCompleted = true;
        localUser.onboardingStep = 'completed';
        if (supabase && dbUser) {
          await supabase.from('users').update({
            onboarding_completed: true,
            onboarding_step: 'completed',
          }).eq('id', dbUser.id);
        }

        await sendTelegramMessage(
          chatId,
          `👑 <b>Assalomu alaykum, Administrator!</b>\n\n` +
          `Siz tizimga administrator sifatida kirdingiz.\n` +
          `👤 ID: <code>${telegramUserId}</code> | Mijoz kodi: <code>${customerCode}</code>\n\n` +
          `Quyidagi menyu orqali kerakli bo'limni ochishingiz mumkin:\n` +
          `1️⃣ <b>🎓 Video darslar</b> — Foydalanuvchi interfeysi\n` +
          `2️⃣ <b>⚙️ Admin Dashboard</b> — Tizim va foydalanuvchilar boshqaruvi`,
          getAdminInlineKeyboard()
        );
        return true;
      }

      // Regular new user: Step 1 is Oferta!
      localUser.onboardingStep = 'oferta';
      const oferta = await getOfertaText();

      await sendTelegramMessage(
        chatId,
        `📜 <b>${oferta.title}</b>\n\n` +
        `${oferta.content}\n\n` +
        `<i>Xizmatdan foydalanish va ro'yxatdan o'tish uchun quyidagi tugma orqali oferta shartlarini qabul qiling:</i>`,
        {
          inline_keyboard: [
            [
              { text: '✅ Qabul qilaman', callback_data: 'oferta_accept' },
              { text: '❌ Rad etaman', callback_data: 'oferta_decline' },
            ],
          ],
        }
      );
      return true;
    }

    if (currentStep === 'oferta') {
      const oferta = await getOfertaText();
      await sendTelegramMessage(
        chatId,
        `Iltimos, avval oferta shartlarini qabul qiling:\n\n📜 <b>${oferta.title}</b>`,
        {
          inline_keyboard: [
            [
              { text: '✅ Qabul qilaman', callback_data: 'oferta_accept' },
              { text: '❌ Rad etaman', callback_data: 'oferta_decline' },
            ],
          ],
        }
      );
      return true;
    }

    if (currentStep === 'phone') {
      await sendTelegramMessage(
        chatId,
        'Iltimos, telefon raqamingizni yozib yuboring:\n<i>(Masalan: +998901234567)</i>',
        { remove_keyboard: true }
      );
      return true;
    }

    // If user is not completed and types academy or other commands, guide them to complete registration
    if (textLower === '/academy' || textLower === '/kurs' || textLower === '/darslar' || textLower === '🎓 video darslar') {
      await sendTelegramMessage(
        chatId,
        '⚠️ <b>Video darslarni ko\'rish uchun avval ro\'yxatdan o\'ting!</b>\n\nIltimos, /start buyrug\'ini yuboring va ro\'yxatdan o\'tishni yakunlang.'
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
      if (isAdmin) {
        await sendTelegramMessage(
          chatId,
          `👑 <b>Assalomu alaykum, Administrator!</b>\n\n` +
          `Siz tizimga administrator sifatida kirdingiz.\n` +
          `👤 ID: <code>${telegramUserId}</code> | Mijoz kodi: <code>${customerCode}</code>\n\n` +
          `Quyidagi menyu orqali kerakli bo'limni ochishingiz mumkin:\n` +
          `1️⃣ <b>⚙️ Admin Dashboard</b> — Tizim va foydalanuvchilar boshqaruvi\n` +
          `2️⃣ <b>🎓 Video darslar</b> — Foydalanuvchi interfeysi`,
          getAdminInlineKeyboard()
        );
        return true;
      }

      await sendTelegramMessage(
        chatId,
        `Assalomu alaykum, <b>${userName}</b>!\n\n` +
        `👤 Sizning shaxsiy mijoz kodingiz: <code>${customerCode}</code>\n\n` +
        `Quyidagi menyu orqali shaxsiy hisobingiz yoki Video darslarni ochishingiz mumkin:`,
        getMainInlineKeyboard(customerCode, userName)
      );
      return true;
    }

    // Academy & Video Lessons command (available to completed users)
    if (textLower === '/academy' || textLower === '/kurs' || textLower === '/darslar' || textLower === '🎓 video darslar') {
      const personalUrl = `${MINI_APP_URL}?code=${encodeURIComponent(customerCode)}&name=${encodeURIComponent(userName)}&app=academy`;
      await sendTelegramMessage(
        chatId,
        `🎓 <b>Yukla Go Akademiya — Video Darslar</b>\n\n` +
        `👤 Shaxsiy mijoz kodingiz: <code>${customerCode}</code>\n\n` +
        `Xitoydan to'g'ri tovar buyurtma qilish bo'yicha bosqichma-bosqich amaliy darslar:\n\n` +
        `✅ 1. Kirish: Xitoy karqo qanday ishlaydi?\n` +
        `▶️ 2. Taobao va 1688 ilovalarida ro'yxatdan o'tish\n` +
        `🔒 3. Xitoy ombor manzilini to'g'ri kiritish\n` +
        `🔒 4. To'lov qilish va mahsulot sifatini tekshirish\n` +
        `🔒 5. Trek kodini kiritish va O'zbekistonda qabul qilish\n\n` +
        `<i>Darslar ketma-ketlikda ochiladi. Har bir darsni to'liq ko'rgach, keyingi dars ochiladi.</i>`,
        {
          inline_keyboard: [
            [{ text: `▶️ Darslarni ochish (${customerCode})`, web_app: { url: personalUrl } }],
            [{ text: `📱 Shaxsiy hisobim`, web_app: { url: `${MINI_APP_URL}?code=${encodeURIComponent(customerCode)}&name=${encodeURIComponent(userName)}` } }],
          ],
        }
      );
      return true;
    }

    // /admin (Exclusive for Admin Telegram IDs)
    if (textLower === '/admin') {
      if (!isAdmin) {
        await sendTelegramMessage(chatId, `⛔ <b>Ruxsat berilmagan:</b> Ushbu buyruq faqat administratorlar uchun mo'ljallangan.`);
        return true;
      }
      await sendTelegramMessage(
        chatId,
        `👑 <b>Admin Dashboard:</b>\n\nQuyidagi tugma orqali boshqaruv panelini ochishingiz mumkin:`,
        {
          inline_keyboard: [
            [{ text: '⚙️ Admin Dashboardni ochish', web_app: { url: `${MINI_APP_URL}#admin` } }],
          ],
        }
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

      await sendTelegramMessage(
        chatId,
        `👤 <b>Mening Profilim:</b>\n\n` +
        `Mijoz kodi: <code>${customerCode}</code>\n` +
        `F.I.SH: <b>${userName}</b>\n` +
        `Telefon: <code>${phoneDisplay}</code>\n\n` +
        `📦 <i>Tovarlaringiz O'zbekistonga yetib kelgach, administrator shaxsan sizga yetkazib beradi.</i>`,
        {
          inline_keyboard: [
            [{ text: '🎓 Video darslarni ochish', web_app: { url: MINI_APP_URL } }],
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
        `Savollaringiz bormi? Admin: @nothing_related`,
        {
          inline_keyboard: [
            [{ text: '☎️ Admin bilan bog\'lanish', url: 'https://t.me/nothing_related' }],
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

        const personalAppUrl = `${MINI_APP_URL}?code=${encodeURIComponent(customerCode)}&name=${encodeURIComponent(userName)}`;
        await sendTelegramMessage(
          chatId,
          `📦 <b>Yuk ma'lumotlari:</b>\n\n` +
          `Trek raqam: <code>${foundParcel.tracking_number}</code>\n` +
          `Holati: <b>${statusInfo.title}</b>\n` +
          `Vazni: <b>${weight}</b>\n` +
          `Narxi: <b>${amount}</b>\n` +
          `To'lov holati: <b>${foundParcel.payment_status === 'paid' ? '✅ To\'langan' : '⏳ To\'lov kutilmoqda'}</b>\n` +
          `Yetkazish: <b>Admin orqali bevosita</b>\n` +
          `\n${statusInfo.desc}`,
          {
            inline_keyboard: [
              [{ text: `📦 Shaxsiy hisobimda ko'rish (${customerCode})`, web_app: { url: personalAppUrl } }],
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
      getMainInlineKeyboard(customerCode, userName)
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

  const fullOneLine = `${receiver}，${phone}，${region} ${address}`;

  const message =
    `🇨🇳 <b>Xitoydagi ombor manzilingiz:</b>\n\n` +
    `👤 <b>Qabul qiluvchi (收件人):</b>\n<code>${receiver}</code>\n\n` +
    `📱 <b>Telefon (手机号码):</b>\n<code>${phone}</code>\n\n` +
    `📍 <b>Hudud (所在地区):</b>\n<code>${region}</code>\n\n` +
    `🏢 <b>Batafsil manzil (详细地址):</b>\n<code>${address}</code>\n\n` +
    `📋 <b>Bitta bosishda nusxalash (Taobao/1688 uchun):</b>\n<code>${fullOneLine}</code>\n\n` +
    `💡 <i>Nusxalash uchun matn ustiga bir marta bosing. Taobao ilovasida manzil qo'shish oynasiga kirsangiz, avtomatik to'ldirish taklif qilinadi.</i>`;

  const personalAppUrl = `${MINI_APP_URL}?code=${encodeURIComponent(customerCode)}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: `📱 Shaxsiy hisobim (${customerCode})`, web_app: { url: personalAppUrl } }],
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
