import { getSupabase } from './supabase.ts';
import { createSessionToken, isTelegramAdmin } from './auth.ts';
import { sendTelegramMessage, answerTelegramCallbackQuery } from './botNotifications.ts';

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://yuklago.vercel.app';

export interface BotUser {
  id: string;
  telegramUserId: number;
  customerCode: string;
  name: string;
  phone: string;
  onboardingCompleted: boolean;
  onboardingStep: 'oferta' | 'name' | 'phone' | 'completed';
}

// In-memory conversation sessions
interface UserSession {
  step: 'oferta' | 'name' | 'phone' | 'completed';
  name?: string;
}

const userSessions = new Map<number, UserSession>();
const inMemoryUsers = new Map<number, BotUser>();

export function wipeBotUser(identifier: string | number): { success: boolean } {
  const numericId = typeof identifier === 'number' ? identifier : Number(identifier);
  if (!isNaN(numericId)) {
    userSessions.delete(numericId);
    inMemoryUsers.delete(numericId);
    return { success: true };
  }
  return { success: false };
}

export function getInMemoryBotUsers(): BotUser[] {
  return Array.from(inMemoryUsers.values());
}

export function getTelegramName(from: any): string {
  const parts = [from?.first_name, from?.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(' ').trim();
  if (from?.username) return `@${from.username}`;
  return 'Hurmatli talaba';
}

export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9) {
    return `+998${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits}`;
  }
  if (digits.length >= 7) {
    return `+${digits}`;
  }
  return raw.trim();
}

export async function processTelegramUpdate(update: any): Promise<boolean> {
  const message = update.message;
  const callbackQuery = update.callback_query;
  const from = message?.from || callbackQuery?.from;
  const chatId = message?.chat?.id || callbackQuery?.message?.chat?.id;

  if (!from || !chatId) return false;

  const telegramUserId = from.id;
  const supabase = getSupabase();

  // 1. Handle Callback Query (Oferta acceptance)
  if (callbackQuery) {
    const data = callbackQuery.data;
    await answerTelegramCallbackQuery(callbackQuery.id);

    if (data === 'accept_oferta') {
      userSessions.set(telegramUserId, { step: 'phone' });

      await sendTelegramMessage(
        chatId,
        '✅ <b>Oferta shartlari qabul qilindi.</b>\n\n' +
          '📱 Ro‘yxatdan o‘tishni yakunlash uchun pastdagi <b>«Telefon raqamni yuborish»</b> tugmasini bosing:',
        {
          keyboard: [
            [
              {
                text: '📱 Telefon raqamni yuborish',
                request_contact: true,
              },
            ],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      );
      return true;
    }

    return true;
  }

  // 2. Handle Contact Share (Native Telegram Button)
  if (message?.contact) {
    const contact = message.contact;
    const phone = contact.phone_number.startsWith('+') ? contact.phone_number : `+${contact.phone_number}`;
    const userName = getTelegramName(from);

    return await completeRegistration(chatId, telegramUserId, from, userName, phone, supabase);
  }

  // 3. Handle Text Messages
  const rawText = message?.text?.trim() || '';

  // Check /start command
  if (rawText.startsWith('/start')) {
    // Check if user is already registered in Supabase
    let existingUser: any = null;
    if (supabase) {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('telegram_user_id', telegramUserId)
          .maybeSingle();
        existingUser = data;
      } catch (err) {
        console.warn('Error checking existing user:', err);
      }
    }

    if (existingUser && existingUser.onboarding_completed) {
      const customerCode = existingUser.customer_code || 'YK-100';
      const userId = existingUser.id;
      let token = '';
      try {
        token = createSessionToken({
          userId,
          telegramUserId,
          customerCode,
          role: isTelegramAdmin(telegramUserId) ? 'admin' : 'customer',
        }, '30d');
      } catch {}

      await sendTelegramMessage(
        chatId,
        `👋 <b>Assalomu alaykum, ${existingUser.name || getTelegramName(from)}!</b>\n\n` +
          `Siz Yukla Go ta’lim platformasidan muvaffaqiyatli ro‘yxatdan o‘tgansiz.\n\n` +
          `👤 <b>Mijoz kodi:</b> <code>${customerCode}</code>\n` +
          `📞 <b>Telefon:</b> <code>${existingUser.phone || 'Kiritilgan'}</code>\n\n` +
          `Darslarni davom ettirish uchun quyidagi tugmani bosing:`,
        {
          inline_keyboard: [
            [
              {
                text: '📚 Kurslarni boshlash',
                callback_data: 'menu_courses',
              },
            ],
          ],
        }
      );
      return true;
    }

    // New User -> Show Oferta with Contact Sharing Button immediately
    userSessions.set(telegramUserId, { step: 'phone' });

    const userName = getTelegramName(from);
    const welcomeText =
      `👋 <b>Assalomu alaykum, ${userName}!</b>\n\n` +
      `Yukla Go yopiq video ta’lim platformasiga xush kelibsiz.\n\n` +
      `Platformamiz orqali Xitoydan tovar olib kelish, 1688, Taobao va xavfsiz import sirlarini bosqichma-bosqich o‘rganasiz.\n\n` +
      `Kursni boshlashdan oldin ommaviy oferta (foydalanish shartlari) bilan tanishib chiqing:\n` +
      `📄 <a href="https://telegra.ph/Yukla-Go-Ommaviy-Oferta-01-01">Ommaviy Oferta shartlarini o‘qish</a>\n\n` +
      `📱 Ro‘yxatdan o‘tish va darslarga kirish uchun pastdagi <b>«Telefon raqamni yuborish»</b> tugmasini bosing:`;

    await sendTelegramMessage(
      chatId,
      welcomeText,
      {
        keyboard: [
          [
            {
              text: '📱 Telefon raqamni yuborish',
              request_contact: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      }
    );
    return true;
  }

  // If user typed phone number manually as text (fallback)
  const formattedPhone = formatPhoneNumber(rawText);
  if (formattedPhone.replace(/\D/g, '').length >= 7) {
    const userName = getTelegramName(from);
    return await completeRegistration(chatId, telegramUserId, from, userName, formattedPhone, supabase);
  }

  // Default fallback: Check if user registered
  let existingUser: any = null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();
      existingUser = data;
    } catch {}
  }

  if (existingUser && existingUser.onboarding_completed) {
    const customerCode = existingUser.customer_code || 'YK-100';
    let token = '';
    try {
      token = createSessionToken({
        userId: existingUser.id,
        telegramUserId,
        customerCode,
        role: isTelegramAdmin(telegramUserId) ? 'admin' : 'customer',
      }, '30d');
    } catch {}

    await sendTelegramMessage(
      chatId,
      `Siz ro‘yxatdan o‘tgansiz. Darslarga kirish uchun quyidagi tugmani bosing:`,
      {
        inline_keyboard: [
          [
            {
              text: '📚 Kurslarni boshlash',
              callback_data: 'menu_courses',
            },
          ],
        ],
      }
    );
    return true;
  }

  // If not registered, prompt to send contact button
  await sendTelegramMessage(
    chatId,
    'Ro‘yxatdan o‘tish uchun pastdagi <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing:',
    {
      keyboard: [
        [
          {
            text: '📱 Telefon raqamni yuborish',
            request_contact: true,
          },
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    }
  );
  return true;
}

async function completeRegistration(
  chatId: number,
  telegramUserId: number,
  from: any,
  userName: string,
  phone: string,
  supabase: any
): Promise<boolean> {
  let customerCode = `YK-${Math.floor(100 + Math.random() * 900)}`;
  let userId = `usr_${telegramUserId}`;

  if (supabase) {
    try {
      // Try generating code via RPC
      try {
        const { data: rpcCode } = await supabase.rpc('generate_customer_code');
        if (rpcCode) customerCode = rpcCode;
      } catch {}

      // Insert or update in users table
      const { data: userRow } = await supabase
        .from('users')
        .upsert(
          {
            telegram_user_id: telegramUserId,
            name: userName.trim(),
            phone: phone.trim(),
            customer_code: customerCode,
            onboarding_completed: true,
            onboarding_step: 'completed',
            status: 'active',
            phone_verified_at: new Date().toISOString(),
          },
          { onConflict: 'telegram_user_id' }
        )
        .select()
        .single();

      if (userRow) {
        userId = userRow.id;
        if (userRow.customer_code) customerCode = userRow.customer_code;


      }
    } catch (err) {
      console.error('Supabase user insert error:', err);
    }
  }

  // Clear session
  userSessions.delete(telegramUserId);

  let token = '';
  try {
    token = createSessionToken({
      userId,
      telegramUserId,
      customerCode,
      role: isTelegramAdmin(telegramUserId) ? 'admin' : 'customer',
    }, '30d');
  } catch {}

  await sendTelegramMessage(
    chatId,
    "✅ Rahmat, ma‘lumotlaringiz qabul qilindi.",
    { remove_keyboard: true }
  );

  const successMessage =
    `🎉 <b>Tabriklaymiz, ${userName}!</b>\n\n` +
    `Siz Yukla Go ta’lim platformasidan muvaffaqiyatli ro‘yxatdan o‘tdingiz.\n\n` +
    `📋 <b>Sizning ma’lumotlaringiz:</b>\n` +
    `• <b>Mijoz kodi:</b> <code>${customerCode}</code>\n` +
    `• <b>Telefon:</b> <code>${phone}</code>\n\n` +
    `👇 Shaxsiy o‘quv kabinetingizga kirish uchun quyidagi tugmani bosing:`;

  await sendTelegramMessage(
    chatId,
    successMessage,
    {
      inline_keyboard: [
        [
          {
            text: '📚 Kurslarni boshlash',
            callback_data: 'menu_courses',
          },
        ],
      ],
    }
  );

  return true;
}
