# Yukla Go — Admin Panel Integratsiyasi va Bog'lanish Qo'llanmasi

Ushbu loyiha **Yukla Go** ning talaba/foydalanuvchi qismi (**User Panel**) bo‘lib, u alohida ishlab chiquvchi sifatida admin paneldan to‘liq ajratilgan holda ishlaydi. Foydalanuvchi ilovasida admin tugmalari yoki admin paneli mavjud emas. Barcha nazorat va o‘zgarishlar admin panel orqali amalga oshiriladi va ushbu ilovaga ta’sir qiladi.

---

## 1. Admin Qonun-Qoidalari va Huquqlari (Admin Rights)

Admin panel orqali o‘zgartirilishi mumkin bo‘lgan barcha parametrlar foydalanuvchi ilovasida dinamik ravishda qo‘llab-quvvatlanadi:

| Admin Huquqi / Sozlamasi | User Appdagi Natijasi |
| :--- | :--- |
| **Foydalanuvchi Access holati (`access: "To‘xtatilgan"`)** | Foydalanuvchiga darslar yopiladi va maxsus **"Kirish vaqtincha to‘xtatildi"** ekrani ko‘rsatiladi. |
| **Foydalanuvchi Access holati (`access: "Faol"`)** | Foydalanuvchi o‘ziga biriktirilgan kurs va darslarni to‘liq ko‘ra oladi. |
| **Darslar tartibi (Drag & Drop)** | Admin darslar tartibini o‘zgartirganda, foydalanuvchida darslar aynan shu tartibda ko‘rinadi. |
| **Yangi dars qo‘shish / tahrirlash** | Yangi darslar ro‘yxatda avtomatik paydo bo‘ladi. `Qoralama` yoki `Yashirilgan` darslar foydalanuvchiga ko‘rsatilmaydi. |
| **Darslarni ketma-ket ochish (`sequentialLessons: true`)** | Talaba 1-darsni tugatmasdan 2-darsga o‘ta olmaydi. 2-dars tugagach 3-dars ochiladi. |
| **Darslarni erkin ochish (`sequentialLessons: false`)** | Barcha darslar foydalanuvchi uchun ochiq bo‘ladi. |
| **Tugallash foizi (`defaultCompletionPercent`, masalan 95%)** | Video aynan belgilangan foizgacha ko‘rilgandagina dars avtomatik tugallangan deb hisoblanadi. |
| **Progressni tiklash (Reset progress)** | Admin foydalanuvchi progressini tiklaganda, foydalanuvchining ko‘rish natijasi 0 dan boshlanadi. |
| **Dynamic Watermark sozlamasi** | Video ustidagi belgi formatini o‘zgartiradi: `YK-104`, `YK-104 • Yukla Go` yoki to‘liq ism bilan. |
| **Anti-scrubbing (Himoya)** | Talaba videoni hali ko‘rmagan qismiga o‘tkaza olmaydi ("Bu qismni hali ko‘rmagansiz"). |

---

## 2. Admin Panelni Bog'lash Mexanizmi

Foydalanuvchi ilovasida barcha ma’lumotlar [src/services/store.ts](file:///c:/Users/Saidislom/Desktop/Yukla%20Go/src/services/store.ts) orqali boshqariladi.

### A. Brauzer orqali sinxronizatsiya (Real-time BroadcastChannel & LocalStorage)
Ikkala ilova (`Yukla Go` va `Admin panel for video lessons`) bir xil brauzerda ochilganda:
- `BroadcastChannel("yukla_go_channel")` orqali xabarlar real vaqtda uzatiladi.
- Admin biror o‘zgarish kiritganda foydalanuvchi sahifasi yangilanmasdan (live reload holda) yangi darslarni yoki holatni darhol aks ettiradi.

#### Xabar formatlari:
```typescript
// 1. Darslar ro'yxati yangilanganda:
broadcastChannel.postMessage({
  type: "UPDATE_LESSONS",
  payload: updatedLessons
});

// 2. Foydalanuvchiga ruxsat berish yoki to'xtatish:
broadcastChannel.postMessage({
  type: "UPDATE_USER_ACCESS",
  payload: { userId: "YK-104", access: "To‘xtatilgan" } // yoki "Faol"
});

// 3. Admin sozlamalari yangilanganda:
broadcastChannel.postMessage({
  type: "UPDATE_SETTINGS",
  payload: {
    defaultCompletionPercent: 95,
    sequentialLessons: true,
    dynamicWatermark: true,
    watermarkFormat: "id-brand"
  }
});

// 4. Foydalanuvchi progressini tiklash:
broadcastChannel.postMessage({
  type: "RESET_USER_PROGRESS",
  payload: { userId: "YK-104" }
});
```

### B. Backend API orqali ulash
Haqiqiy backend (Node.js, Supabase, Python, PostgreSQL va h.k.) qo‘shilganda:
- [src/services/store.ts](file:///c:/Users/Saidislom/Desktop/Yukla%20Go/src/services/store.ts) ichidagi funksiyalarga o‘zingizning API chaqiruvlaringizni joylashtirasiz.

---

## 3. Foydalanuvchini Tanlash va Sinovdan O'tkazish

Brauzer URL manzilida quyidagi parametrlar orqali turli foydalanuvchilar holatini sinab ko‘rishingiz mumkin:

- **Faol talaba (Murod Karimov):** `?user=YK-104`
- **To‘xtatilgan talaba (Madina Sobirova):** `?user=YK-314` (To‘xtatilgan ekranni ko‘rish uchun)
- **Boshqa talaba (Sevara Akramova):** `?user=YK-219`
- **Darslar yo‘q holati:** `?state=empty`
- **Xatolik holati:** `?state=error`
