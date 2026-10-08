import { academyBot } from "./academy-bot.mjs"
import {
  check,
  admins,
  escapeHtml as e,
  ensureStudent,
  addressFields,
} from "./security.mjs"
export const homeKeyboard = [
  ["🆔 ID olish", "🇨🇳 Ombor manzili"],
  ["🎓 Video darslar", "💰 Tarif"],
  ["👤 Profilim", "📞 Yordam"],
]
const back = {
  keyboard: [["⬅️ Orqaga", "🏠 Asosiy menyu"]],
  resize_keyboard: true,
}
const home = { keyboard: homeKeyboard, resize_keyboard: true }
export async function botUpdate(update, db, call) {
  const m = update.message,
    q = update.callback_query,
    from = m?.from || q?.from,
    chat = m?.chat || q?.message?.chat
  if (!from || !chat || chat.type !== "private") return
  const tg = from.id,
    text = m?.text?.trim() || "",
    admin = admins().includes(tg)
  const send = (id, t, markup) =>
    call("sendMessage", {
      chat_id: id,
      text: t,
      parse_mode: "HTML",
      reply_markup: markup,
    })
  const say = (t, markup) => send(chat.id, t, markup)
  if (q)
    try {
      await call("answerCallbackQuery", { callback_query_id: q.id })
    } catch {
      /* Expired callbacks must not prevent a retry. */
    }
  const user = await ensureStudent(db, from)
  if (user.status === "blocked") {
    await say("⛔ Hisobingiz to‘xtatilgan. Admin bilan bog‘laning.")
    return
  }
  const support = process.env.SUPPORT_USERNAME?.replace(/^@/, "")
  async function address(id, code) {
    const f = addressFields(code)
    await send(
      id,
      `✅ <b>Yukla GO</b>\n🆔 Sizning ID: <code>${e(code)}</code>\n🚚 Avto cargo — <b>$7/kg</b>\n\n收货人: <code>${f.recipient}</code>\n手机号码: <code>${f.phone}</code>\n详细地址: <code>${f.address}</code>`,
      {
        inline_keyboard: [
          [
            { text: "📋 Qabul qiluvchi", copy_text: { text: f.recipient } },
            { text: "📋 Telefon", copy_text: { text: f.phone } },
          ],
          [{ text: "📋 Manzilni nusxalash", copy_text: { text: f.address } }],
        ],
      },
    )
  }
  const academy = academyBot({ db, call, user, tg, admin, say, home })
  async function courses() {
    await academy.courses()
  }
  if (await academy.handle(update)) return
  if (q) {
    const d = q.data || ""
    if (d === "courses_request") {
      await courses()
      return
    }
    if (d.startsWith("req:")) {
      const cid = d.slice(4),
        course = check(
          await db
            .from("academy_courses")
            .select("*")
            .eq("id", cid)
            .eq("active", true)
            .maybeSingle(),
        )
      if (!course) return
      const access = check(
        await db
          .from("academy_access")
          .select("status")
          .eq("user_id", user.id)
          .eq("course_id", cid)
          .maybeSingle(),
      )
      if (access?.status === "granted") {
        await courses()
        return
      }
      check(
        await db
          .from("academy_access")
          .upsert(
            {
              user_id: user.id,
              course_id: cid,
              status: "pending",
              requested_at: new Date().toISOString(),
            },
            { onConflict: "user_id,course_id", ignoreDuplicates: true },
          ),
      )
      // Buttons reference the access row to remain under Telegram's 64-byte limit.
      const row = check(
        await db
          .from("academy_access")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", cid)
          .single(),
      )
      for (const id of admins())
        await send(
          id,
          `💳 Kursga so‘rov\n👤 ${e(user.name)}\nTelegram: <code>${tg}</code>\nKurs: ${e(course.title)}\nTo‘lovni tekshirgandan keyin ruxsat bering.`,
          {
            inline_keyboard: [
              [{ text: "✅ Ruxsat berish", callback_data: `grant:${row.id}` }],
            ],
          },
        )
      await say(
        "✅ So‘rov yuborildi. To‘lov va kursga kirish bo‘yicha admin javobini kuting.",
        home,
      )
      return
    }
    if (d.startsWith("docs:")) {
      if (!admin) return
      const a = check(
        await db
          .from("cargo_applications")
          .select("*")
          .eq("telegram_user_id", Number(d.slice(5)))
          .single(),
      )
      for (const side of ["photo_front", "photo_back"])
        await call("sendPhoto", {
          chat_id: tg,
          photo: a.data[side],
          protect_content: true,
        })
      await say(
        `👤 ${e(a.data.first_name)} ${e(a.data.last_name)}\n📱 ${e(a.data.phone)}\nPasport: ${e(a.data.passport)}\nJShShIR: ${e(a.data.pinfl)}\nManzil: ${e(a.data.address)}`,
        {
          inline_keyboard: [
            [
              {
                text: "✅ Tasdiqlash",
                callback_data: `approve:${a.telegram_user_id}`,
              },
              {
                text: "❌ Rad etish",
                callback_data: `reject:${a.telegram_user_id}`,
              },
            ],
          ],
        },
      )
      return
    }
    if (d.startsWith("grant:")) {
      if (!admin) return
      const row = check(
        await db
          .from("academy_access")
          .select("*")
          .eq("id", d.slice(6))
          .single(),
      )
      check(
        await db
          .from("academy_access")
          .update({
            status: "granted",
            granted_at: new Date().toISOString(),
            granted_by: tg,
          })
          .eq("id", row.id),
      )
      const target = check(
        await db
          .from("users")
          .select("telegram_user_id")
          .eq("id", row.user_id)
          .single(),
      )
      await send(
        target.telegram_user_id,
        "✅ Kursga kirish ochildi. «🎓 Video darslar» tugmasini bosing.",
        home,
      )
      await say("✅ Kursga ruxsat berildi.")
      return
    }
    if (d.startsWith("approve:") || d.startsWith("reject:")) {
      if (!admin) return
      const approve = d.startsWith("approve:"),
        target = Number(d.split(":")[1])
      const result = check(
        await db.rpc("eucla_review", {
          p_tg: target,
          p_admin: tg,
          p_approve: approve,
        }),
      )
      await say(
        result.status === "approved"
          ? `✅ Tasdiqlandi: <code>${e(result.code)}</code>`
          : "❌ Ariza rad etildi.",
      )
      if (result.status === "approved") await address(target, result.code)
      else
        await send(
          target,
          "❌ Arizangiz rad etildi. Ma’lumotlarni tekshirib «🆔 ID olish» orqali qayta yuborishingiz mumkin.",
          home,
        )
      return
    }
    return
  }
  const app = check(
    await db
      .from("cargo_applications")
      .select("*")
      .eq("telegram_user_id", tg)
      .maybeSingle(),
  )
  async function notifyApplication(d) {
    for (const id of admins()) {
      for (const side of ["photo_front", "photo_back"])
        await call("sendPhoto", {
          chat_id: id,
          photo: d[side],
          caption: `${tg}: ${side === "photo_front" ? "Old" : "Orqa"} taraf`,
          protect_content: true,
        })
      await send(
        id,
        `🪪 <b>Yangi cargo ariza</b>\n👤 ${e(d.first_name)} ${e(d.last_name)}\n📱 ${e(d.phone)}\nPasport: ${e(d.passport)}\nJShShIR: ${e(d.pinfl)}\nManzil: ${e(d.address)}`,
        {
          inline_keyboard: [
            [
              {
                text: "✅ Tasdiqlash va ID berish",
                callback_data: `approve:${tg}`,
              },
            ],
            [{ text: "❌ Rad etish", callback_data: `reject:${tg}` }],
          ],
        },
      )
    }
  }
  if (app?.status === "pending" && text === "✅ Tasdiqlash") {
    await notifyApplication(app.data)
    await say("✅ Hujjatlaringiz admin tekshiruvida.", home)
    return
  }
  if (admin && text === "/applications") {
    const pending =
      check(
        await db.from("cargo_applications").select("*").eq("status", "pending"),
      ) || []
    await say(`Tekshiruvdagi arizalar: ${pending.length}`)
    for (const a of pending)
      await say(
        `${e(a.data.first_name)} ${e(a.data.last_name)} — ${a.telegram_user_id}`,
        {
          inline_keyboard: [
            [
              {
                text: "Hujjatlarni ko‘rish",
                callback_data: `docs:${a.telegram_user_id}`,
              },
            ],
          ],
        },
      )
    return
  }
  const save = async (step, data, status = "draft") => {
    const saved = check(
      await db.rpc("yukla_save_application", {
        p_tg: tg,
        p_update: update.update_id,
        p_expected_step: app?.step || null,
        p_expected_status: app?.status || null,
        p_step: step,
        p_data: data,
        p_status: status,
      }),
    )
    if (!saved) throw new Error("Application changed; retry update")
  }
  // A failed Telegram response must not consume the same input as the next field.
  if (app?.last_update_id === update.update_id && app.status === "draft") {
    await prompt(app.step)
    return
  }

  if (text === "⬅️ Orqaga" && app?.status === "draft") {
    const steps = [
      "terms",
      "phone",
      "first_name",
      "last_name",
      "passport",
      "pinfl",
      "address",
      "photo_front",
      "photo_back",
      "confirm",
    ]
    const previous = steps[Math.max(0, steps.indexOf(app.step) - 1)]
    await save(previous, app.data)
    await prompt(previous)
    return
  }
  if (
    text.startsWith("/start") ||
    text === "🏠 Asosiy menyu" ||
    text === "/home" ||
    text === "/menu" ||
    text === "⬅️ Orqaga"
  ) {
    if (process.env.WELCOME_STICKER_FILE_ID)
      try {
        await call("sendSticker", {
          chat_id: tg,
          sticker: process.env.WELCOME_STICKER_FILE_ID,
        })
      } catch {}
    await say(
      "🏠 <b>Yukla GO</b>\nKerakli bo‘limni tanlang. Video darslar uchun cargo ro‘yxatidan o‘tish shart emas.",
      home,
    )
    return
  }
  if (["🎓 Video darslar", "🎬 Video darslar"].includes(text)) {
    await courses()
    return
  }
  if (text === "📞 Yordam") {
    await say(
      support
        ? `📞 Yordam: @${e(support)}`
        : "📞 Savolingizni shu botga matn sifatida yuboring.",
      home,
    )
    return
  }
  if (["💰 Tarif", "💰 Kargo narxlari"].includes(text)) {
    await say("🚚 <b>Avto cargo</b>\n📦 Tarif: <b>$7/kg</b>", home)
    return
  }
  if (["🇨🇳 Ombor manzili", "📍 Xitoy manzili", "/address"].includes(text)) {
    if (user.onboarding_completed && /^YK-?\d+$/.test(user.customer_code))
      await address(tg, user.customer_code)
    else
      await say(
        "🆔 Ombor manzilini olish uchun «ID olish» orqali hujjatlarni yuboring. Admin tasdiqlagach shaxsiy manzilingiz beriladi.",
        home,
      )
    return
  }
  if (text === "👤 Profilim") {
    await say(
      `👤 ${e(user.name)}\n🆔 Cargo ID: ${
        user.onboarding_completed ? e(user.customer_code) : "Hali berilmagan"
      }\nAriza: ${e(app?.status || "Topshirilmagan")}`,
      home,
    )
    return
  }
  const idRequest = ["🆔 ID olish", "🆔 Id Ko'd olish", "/register"].includes(
    text,
  )
  if (idRequest) {
    if (user.onboarding_completed && /^YK-?\d+$/.test(user.customer_code)) {
      await address(tg, user.customer_code)
      return
    }
    if (app?.status === "pending") {
      await say("⏳ Hujjatlaringiz admin tekshiruvida.", home)
      return
    }
    if (app?.status === "draft") {
      await prompt(app.step)
      return
    }
    await save("terms", {})
    await prompt("terms")
    return
  }
  async function prompt(step, preview = app?.data) {
    const prompts = {
      terms:
        "📋 Avto cargo — $7/kg. Hujjatlar admin tomonidan tekshirilgach ID beriladi.",
      phone: "📱 O‘zingizning telefon raqamingizni tugma orqali yuboring.",
      first_name: "👤 Ismingizni kiriting:",
      last_name: "👤 Familiyangizni kiriting:",
      passport: "🪪 Pasport yoki ID karta seriya raqami (masalan, AA1234567):",
      pinfl: "🔢 14 xonali JShShIR raqamingiz:",
      address: "📍 Yashash manzilingizni to‘liq kiriting:",
      photo_front: "🪪 Pasport/ID kartaning old tarafi rasmini yuboring:",
      photo_back: "🪪 Pasport/ID kartaning orqa tarafi rasmini yuboring:",
      confirm: "📋 «✅ Tasdiqlash» tugmasi bilan hujjatlarni adminga yuboring.",
    }
    if (step === "terms") {
      const url = process.env.OFERTA_URL
      if (!url) {
        await say(
          "📋 Ro‘yxatdan o‘tish shartlari tayyorlanmoqda. Admin bilan bog‘laning.",
          home,
        )
        return
      }
      await say(
        `${prompts.terms}\n\n<a href="${e(url)}">Oferta bilan tanishish</a>\nOferta bilan tanishib, roziligingizni tasdiqlang.`,
        {
          keyboard: [["✅ Roziman"], ["🏠 Asosiy menyu"]],
          resize_keyboard: true,
        },
      )
      return
    }
    if (step === "confirm" && preview)
      await say(
        `📋 <b>Tekshiring</b>\n${e(preview.first_name)} ${e(preview.last_name)}\n${e(preview.phone)}\nPasport: ${e(preview.passport)}\nJShShIR: ${e(preview.pinfl)}\nManzil: ${e(preview.address)}`,
      )
    await say(
      prompts[step] || prompts.first_name,
      step === "phone"
        ? {
            keyboard: [
              [{ text: "📱 Telefon raqamim", request_contact: true }],
              ["🏠 Asosiy menyu"],
            ],
            resize_keyboard: true,
          }
        : step === "confirm"
          ? {
              keyboard: [
                ["✅ Tasdiqlash"],
                ["🔄 Qaytadan kiritish"],
                ["⬅️ Orqaga", "🏠 Asosiy menyu"],
              ],
              resize_keyboard: true,
            }
          : back,
    )
  }
  if (app?.status === "draft") {
    const d = { ...app.data },
      step = app.step
    if (step === "terms") {
      if (text !== "✅ Roziman" || !process.env.OFERTA_URL) {
        await prompt(step)
        return
      }
      d.consented_at = new Date().toISOString()
      d.oferta_url = process.env.OFERTA_URL
      await save("phone", d)
      await prompt("phone")
      return
    }
    const next = {
      phone: "first_name",
      first_name: "last_name",
      last_name: "passport",
      passport: "pinfl",
      pinfl: "address",
      address: "photo_front",
      photo_front: "photo_back",
      photo_back: "confirm",
    }
    if (step === "phone") {
      if (!m.contact || m.contact.user_id !== tg) {
        await prompt(step)
        return
      }
      d.phone = "+" + m.contact.phone_number.replace(/\D/g, "")
      if (!/^\+\d{10,15}$/.test(d.phone)) {
        await prompt(step)
        return
      }
    } else if (step === "passport") {
      if (!/^[A-Za-z]{2}\d{7}$/.test(text)) {
        await prompt(step)
        return
      }
      d.passport = text.toUpperCase()
    } else if (step === "pinfl") {
      if (!/^\d{14}$/.test(text)) {
        await prompt(step)
        return
      }
      d.pinfl = text
    } else if (step.startsWith("photo_")) {
      if (!m.photo?.length) {
        await prompt(step)
        return
      }
      d[step] = m.photo.at(-1).file_id
    } else if (step === "confirm") {
      if (text === "🔄 Qaytadan kiritish") {
        await save("terms", {})
        await prompt("terms")
        return
      }
      if (text !== "✅ Tasdiqlash") {
        await prompt(step)
        return
      }
      await save("confirm", d, "pending")
      await notifyApplication(d)
      await say("✅ Hujjatlaringiz qabul qilindi. Admin javobini kuting.", home)
      return
    } else {
      if (text.length < 2 || text.length > 300) {
        await prompt(step)
        return
      }
      d[step] = text
    }
    await save(next[step], d)
    await prompt(next[step], d)
    return
  }
  if (text || m.photo) {
    for (const id of admins())
      await call("forwardMessage", {
        chat_id: id,
        from_chat_id: chat.id,
        message_id: m.message_id,
      })
    await say("✅ Xabaringiz adminga yuborildi.", home)
  } else await say("Kerakli bo‘limni tanlang.", home)
}
