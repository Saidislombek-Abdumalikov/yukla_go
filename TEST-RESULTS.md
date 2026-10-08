# Yukla GO — tekshiruv hisoboti

Sana: 2026-10-08. Lokal Node.js 24.19, npm; ma’lumotlar bazasi testlarida PGlite (PostgreSQL), Telegram chaqiruvlarida mock ishlatilgan.

## O‘tgan tekshiruvlar

- `npm test`: 14 test, 0 xato. Database test ichida alohida SQL assertionlar mavjud.
- Backend/frozen user app: `npm run typecheck`, `npm run build` — muvaffaqiyatli.
- Admin: `npm run typecheck`, `npm run build` — muvaffaqiyatli.
- API va yangi bot modullari Node sintaksis tekshiruvidan o‘tgan.
- 2 GB **metadata** va uzun file_id: bazaga saqlash, yuborishda shu file_id’dan foydalanish, callback 64 baytdan oshmasligi. Haqiqiy 2 GB video tarmoq orqali yuborilmagan.
- Video biriktirishda admin tekshiruvi; boshqa admin uploadidan foydalanishni SQL rad etadi. Bir tugmani qayta bosish o‘sha uploadni boshqa darsga ko‘chirmaydi.
- Dars ruxsati, tartibi, qayta ko‘rish, takroriy yakunlash, bitta progress yozuvi; ruxsatni olib tashlaganda yuborish/yakunlash rad etilishi.
- Tasdiq saqlangandan keyin video yuborish xatosi: haqiqiy keyingi darsni qayta yuborish tugmasi. Soxta ko‘rilgan soniyalar yozilmaydi.
- Webhook secret yo‘q bo‘lsa 401; update’ni qayta claim qilish, failed holatdan retry va done update’ni takrorlamaslik.
- Oddiy /start cargo ID bermaydi, video menyusi pasport talab qilmaydi, Mini App tugmasi yo‘q.
- Cargo bosqichlari, boshqa odamning kontaktini rad etish, ikki rasm va tasdiqlash, ombor nusxalash maydonlari.
- Telegram javobi uzilgandan keyin bir xil update keyingi maydonga yozilmaydi; SQL eskirgan bosqichni va pending arizani qayta yozishni rad etadi.
- Cargo ID takroriy tasdiqda o‘zgarmaydi, o‘chirilgan ID qayta ishlatilmaydi; eski YK-104 saqlanadi; eski sequence’da sarflangan raqam ham hisobga olinadi. Cargo tasdig‘i kurs ruxsati bermaydi.
- Migratsiyalarni qayta bajarish, yangi SQL funksiyalariga anon/authenticated kirishining yopilishi.
- Sessiya imzosi, barcha joriy admin mutatsiyalarining student sessiyasini rad etishi; frozen Mini App login/sessiyalari bloklanishi.
- Stiker va eskirgan callback javobi xatosi asosiy amalni to‘xtatmasligi.

## Chegaralar

Jonli Telegram, Vercel va Supabase o‘zgartirilmagan. Haqiqiy webhook yetkazilishi, Supabase production sxemasi bilan migratsiya, katta video uzatilishi, turli telefonlarda protect_content/copy tugmalari, admin panelning haqiqiy domenlararo ulanishi va to‘liq jonli end-to-end oqim tekshirilmagan. SQL test bazasi kerakli jadvallarni modellashtiradi; production bazasining nusxasi emas.

Vite build muvaffaqiyatli, ammo mavjud Figma Vite konfiguratsiyasida kelajakdagi native config loader uchun `__dirname` va JSON import haqida ogohlantirish bor. Bu joriy buildni to‘xtatmadi.

Telegramga xabar yuborish va PostgreSQL yozuvi umumiy tranzaksiya bo‘la olmaydi. Tarmoq javobi yo‘qolganda xabar ikki marta yetishi mumkin; progress yozuvi va ID berish idempotent. «Ko‘rib bo‘ldim» real ko‘rish isboti emas.

## Kod va ma’lumotlar

Vercel API entrypoint/rewrite saqlangan. User App.tsx va eski qo‘llab-quvvatlovchi kod o‘chirilmagan; yangi main.tsx freeze ekranini chiqaradi. Faol bot boshqa kompaniya ofertasi yoki eski user appdagi namunaviy tariflardan foydalanmaydi. Adminning endi chaqirilmaydigan Supabase upload funksiyasi, file picker ishlovi, upload navbati va faol API’dagi bo‘sh cache wrapperlari tozalangan. Faol server kodiga formatter qo‘llangan. SQL foydalanuvchi, kurs, ruxsat yoki progress jadvallarini o‘chirmaydi.
