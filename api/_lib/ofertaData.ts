import { getSupabase } from './supabase.ts';

export const DEFAULT_OFERTA_TITLE = 'Yukla Go Xizmatidan Foydalanish Shartlari (Ommaviy Oferta)';

export const DEFAULT_OFERTA_CONTENT = `1. Umumiy qoidalar:
Ushbu ommaviy oferta "Yukla Go" xizmati orqali Xitoydan O'zbekistonga posilka va tovarlarni yetkazib berish xizmatidan foydalanish qoidalarini belgilaydi.

2. Ro'yxatdan o'tish va mijoz kodi:
Har bir foydalanuvchiga shaxsiy identifikatsiya kodi (masalan: YK-100) biriktiriladi. Foydalanuvchi barcha xaridlarida ombor manziliga ushbu kodni to'liq kiritishi shart.

3. Taqiqlangan tovarlar:
Aviakargo orqali suyuqliklar, litiy batareyalar, qurol-yarog', tez yonuvchan moddalar, qalbaki tovarlar va O'zbekiston qonunchiligida taqiqlangan boshqa mahsulotlarni yuborish qat'iyan man etiladi.

4. Yetkazib berish va to'lov:
Yuklar O'zbekistonga yetib kelgach, amaldagi tarif bo'yicha hisob-kitob qilinadi. To'lov yuk topshirilguniga qadar to'liq amalga oshirilishi shart.

5. O'quv materiallari va darslar:
Yukla Go Akademiya video darslari xizmatdan to'g'ri foydalanishni o'rgatish maqsadida taqdim etiladi. Darslarni nusxalash, tarqatish yoki uchinchi shaxslarga berish taqiqlanadi.`;

let inMemoryOferta = {
  title: DEFAULT_OFERTA_TITLE,
  content: DEFAULT_OFERTA_CONTENT,
  updatedAt: new Date().toISOString(),
};

/**
 * Get active Oferta text and title (from DB if available, otherwise in-memory)
 */
export async function getOfertaText(): Promise<{ title: string; content: string }> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await supabase
        .from('oferta_versions')
        .select('title, content')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();
      if (data && data.content) {
        inMemoryOferta = {
          title: data.title || DEFAULT_OFERTA_TITLE,
          content: data.content,
          updatedAt: new Date().toISOString(),
        };
        return { title: inMemoryOferta.title, content: inMemoryOferta.content };
      }
    } catch {}
  }
  return { title: inMemoryOferta.title, content: inMemoryOferta.content };
}

/**
 * Update active Oferta text and title (Admin panel action)
 */
export async function updateOfertaText(content: string, title?: string): Promise<boolean> {
  const cleanContent = content.trim();
  const cleanTitle = title?.trim() || inMemoryOferta.title || DEFAULT_OFERTA_TITLE;

  inMemoryOferta = {
    title: cleanTitle,
    content: cleanContent,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('oferta_versions').upsert({
        version: Date.now(),
        title: cleanTitle,
        content: cleanContent,
        is_active: true,
      });
    } catch {}
  }
  return true;
}
