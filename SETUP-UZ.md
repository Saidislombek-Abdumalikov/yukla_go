# Yukla GO — Telegram bot + admin panel

Foydalanuvchi xizmatlari va video darslar Telegram botda. Vercel backend saqlangan: `api/index.js` → `server/bot.mjs` → `server/academy-bot.mjs`. `sync-server.mjs` lokal API uchun. Admin alohida Vite loyihasi orqali shu API va shu Supabase bazasi bilan ishlaydi. Polling ishga tushirmang.

## 1. SQL

Mavjud baza uchun `supabase/UPGRADE-TELEGRAM.sql` faylini Supabase SQL Editor’da bajaring. U 0004 va 0005 migratsiyalarini tartib bilan birlashtiradi; qayta bajarish ham kurslar, ruxsatlar va IDlarni o‘chirmaydi. 0001–0003 mavjud deb hisoblanadi. `full_schema.sql` yoki boshlang‘ich migratsiyalarni mavjud bazaga qayta qo‘llamang. Avval bazaning zaxira nusxasini saqlang.

Agar 0004 avval bajarilgan bo‘lsa, faqat `supabase/migrations/0005_yukla_telegram.sql` ham yetarli. Yangi ustunlar, xizmat funksiyalari va admin video metadata jadvali qo‘shiladi. Yangi cargo ID faqat tasdiqlashda sequence orqali beriladi. Eski YK-100 kabi IDlar o‘zgarmaydi.

## 2. Mavjud Vercel backend

Mavjud loyihani o‘chirmang; `Yukla Go` papkasidagi yangilangan kodni shu loyihaga joylang. Build: `npm ci` va `npm run build`. Output: `dist`. Node.js 22.12+ yoki 24 ishlating. `vercel.json` API rewrite saqlangan.

Server muhit o‘zgaruvchilari:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: mavjud bazaniki.
- `BOT_TOKEN` (yoki eski `TELEGRAM_BOT_TOKEN`): aynan mavjud bot tokeni.
- `TELEGRAM_WEBHOOK_SECRET`: tasodifiy maxfiy qiymat.
- `SESSION_SECRET`: kamida 32 belgilik tasodifiy maxfiy qiymat.
- `ADMIN_PASSWORD`: kuchli admin paroli.
- `ADMIN_TELEGRAM_IDS`: adminlarning sonli Telegram IDlari, vergul bilan.
- `BACKEND_URL`: mavjud backendning HTTPS manzili. Eski `MINI_APP_URL` faqat URL fallback sifatida qabul qilinadi; bot unga tugma chiqarmaydi.
- `ALLOWED_ORIGINS`: admin domeni (va kerak bo‘lsa backend domeni), vergul bilan.
- `OFERTA_URL`: o‘zingizning haqiqiy ofertangizning HTTPS havolasi. Bo‘sh bo‘lsa cargo hujjat yig‘ish boshlanmaydi. Shartlar yaratilmagan.
- `SUPPORT_USERNAME`: yordam akkaunti, `@` bilan yoki usiz. Bo‘sh bo‘lsa matnli xabarlar bot adminlariga yo‘naltiriladi.
- `WELCOME_STICKER_FILE_ID`: ixtiyoriy, shu botga tegishli haqiqiy stiker IDsi. Bo‘sh qoldirish mumkin.

Maxfiy qiymatlarni `VITE_` bilan boshlamang. Paketda haqiqiy kalitlar yo‘q.

Deploymentdan so‘ng ushbu server muhit qiymatlari yuklangan terminalda `node scripts/set-webhook.mjs` bajaring. Skript webhookni o‘rnatadi, `max_connections: 1` bilan ketma-ket update qabul qiladi va botning umumiy Web App menyu tugmasini commands menyusiga almashtiradi. Eski update’larni o‘chirmaydi. Skript bu ish davomida jonli ishga tushirilmagan.

BotFather’da oldindan o‘rnatilgan Main Mini App/Launch App tugmasi bo‘lsa, uni ham o‘chiring. Eski yuborilgan xabarlardagi Mini App tugmalari tarixda qolishi mumkin, lekin user frontend vaqtincha yopilgan va eski student sessiyalari API orqali rad etiladi. App.tsx va eski user app kodi saqlangan.

## 3. Admin panel

`Admin panel for video lessons` loyihasini mavjud admin deploymentiga yuklang. `VITE_API_URL=https://SIZNING_BACKEND.vercel.app/api` o‘rnating, `npm ci`, `npm run build`; output `dist`. Backend `ALLOWED_ORIGINS` ichiga aynan admin originini kiriting.

1. Kurs va dars yarating. Videoni web panelga yuklamang.
2. `ADMIN_TELEGRAM_IDS` dagi akkauntdan botga videoni **video sifatida** yuboring (Document/File sifatida emas).
3. Bot ko‘rsatgan «kurs • dars» tugmasini tanlang. Uzun file_id bazada qoladi, callback qisqa UUID va indeksdan iborat.
4. Video Telegramdan `file_id` orqali qayta yuboriladi; server uni yuklab olmaydi, Supabase video trafikini ishlatmaydi.
5. Foydalanuvchi botda `/start` bosadi. To‘lovni tekshirib, admin panelda uning profilidan aynan kerakli kursga ruxsat bering. Botdagi kurs so‘rovi ostidagi tasdiqlash tugmasi ham ishlaydi. Cargo tasdig‘i kurs ruxsatini bermaydi.
6. Ruxsat olib tashlansa keyingi video yuborishlar va yakunlash rad etiladi. Avval Telegramga yuborilgan videoni foydalanuvchidan masofadan qaytarib olish kafolatlanmaydi.

Eski `youtube_video_id` JSON ichidagi `file_id` bo‘lsa migratsiya undan foydalanadi. Faqat URL bo‘lgan darslarga videoni Telegram orqali bir marta qayta biriktirish kerak. Boshqa botdan olingan file_id mos kelmaydi.

`protect_content` odatiy saqlash/forwardni cheklaydi; mutlaq yuklab olish yoki ekran yozish himoyasi emas. «✅ Ko‘rib bo‘ldim» — foydalanuvchi tasdig‘i. Haqiqiy tomosha vaqti yozilmaydi. Birinchi darsdan boshlab ketma-ket tekshiriladi. Takroriy tasdiq bitta progress yozuvini yangilaydi, keyingi dars yuborilmasa qayta yuborish tugmasi chiqadi. Tarmoq javobi yo‘qolgan holatda Telegram xabari takroran yetishi mumkin; DB progress va cargo ID takrorlanmaydi.

Rasmiy API: https://core.telegram.org/bots/api#sending-files va https://core.telegram.org/bots/api#sendvideo . Katta videoning file_id bilan jo‘natilishi va himoya xatti-harakatini haqiqiy telefonlarda tekshiring.

## 4. Cargo va tekshiruv

`/start` faqat profil va menyu yaratadi. «🆔 ID olish» → oferta → o‘z kontakti → ism → familiya → pasport/ID → 14 xonali JShShIR → manzil → old/orqa rasm → tekshirish → adminga yuborish. Admin `/applications` orqali pending arizalarni qayta ochadi. Rad etilgan ariza «ID olish» orqali qayta topshiriladi.

Tasdiqdan keyin YK1, YK2… beriladi. Omborda faqat manzil oxiridagi qavsga mijoz IDsi qo‘yiladi, `真RC-554` va `18922155990` o‘zgarmaydi. Tarif faqat Avto — $7/kg.

Lokal tekshiruv: backend papkasida `npm test`, `npm run typecheck`, `npm run build`; admin papkasida `npm run typecheck`, `npm run build`.

Jonli tekshiruv tartibi: admin video biriktirishi → ruxsatsiz mijoz → kursga ruxsat → dars/replay/tasdiq → eski tugma → ruxsatni bekor qilish → cargo ariza/reject/resubmit/approve → nusxalash tugmalari. Jonli tekshiruv bu paket tayyorlanayotganda bajarilmadi.
