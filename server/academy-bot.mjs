import { check, escapeHtml as e } from "./security.mjs"
const nav = [
  { text: "⬅️ Orqaga", callback_data: "courses" },
  { text: "🏠 Asosiy menyu", callback_data: "home" },
]
export function academyBot({ db, call, user, tg, admin, say, home }) {
  const keyboard = (rows) => ({ inline_keyboard: [...rows, nav] })
  async function courses() {
    const rows =
      check(
        await db
          .from("academy_courses")
          .select("*")
          .eq("active", true)
          .order("order"),
      ) || []
    await say(
      "🎓 Kurslar pullik. Kirishni admin to‘lovdan keyin ochadi. Cargo ID yoki pasport talab qilinmaydi.",
      keyboard(
        rows.map((c) => [
          { text: c.title, callback_data: `course:${c.bot_key}` },
        ]),
      ),
    )
  }
  async function lesson(key, complete = false) {
    const result = await db.rpc("yukla_lesson_action", {
      p_user: user.id,
      p_key: key,
      p_complete: complete,
    })
    if (result.error) {
      await say(
        "🔒 Kurs ruxsati yoki oldingi dars tasdig‘ini tekshiring.",
        keyboard([]),
      )
      return
    }
    const l = result.data
    if (!l) {
      await say("🎉 Kursdagi darslarni yakunladingiz!", keyboard([]))
      return
    }
    if (!l.telegram_file_id) {
      await say("⏳ Bu dars videosi hali biriktirilmagan.", keyboard([]))
      return
    }
    try {
      await call("sendVideo", {
        chat_id: tg,
        video: l.telegram_file_id,
        protect_content: true,
        caption: `🎬 ${l.title}\n\n“Ko‘rib bo‘ldim” — sizning tasdig‘ingiz. Bot tomosha vaqtini o‘lchamaydi.`,
        reply_markup: keyboard([
          [{ text: "✅ Ko‘rib bo‘ldim", callback_data: `done:${l.bot_key}` }],
          [{ text: "🔁 Qayta ko‘rish", callback_data: `play:${l.bot_key}` }],
        ]),
      })
    } catch {
      await say(
        "Video yuborilmadi. Qayta urinib ko‘ring.",
        keyboard([
          [{ text: "🔄 Qayta yuborish", callback_data: `play:${l.bot_key}` }],
        ]),
      )
    }
  }
  async function choices(upload, page = 0) {
    const all = upload.choices || [],
      start = page * 8
    const rows = all
      .slice(start, start + 8)
      .map((l, i) => [
        {
          text: l.label.slice(0, 100),
          callback_data: `bind:${upload.id}:${start + i}`,
        },
      ])
    if (start + 8 < all.length)
      rows.push([
        {
          text: "Keyingi darslar ➡️",
          callback_data: `media:${upload.id}:${page + 1}`,
        },
      ])
    await say("📎 Videoni qaysi darsga biriktirasiz?", keyboard(rows))
  }
  async function handle(update) {
    const m = update.message,
      q = update.callback_query,
      d = q?.data || ""
    if (admin && m?.document?.mime_type?.startsWith("video/")) {
      await say(
        "Videoni fayl sifatida emas, Telegramdagi video sifatida yuboring.",
        home,
      )
      return true
    }
    if (m?.video) {
      if (!admin) {
        await say("Video biriktirish faqat admin uchun.", home)
        return true
      }
      const lessons =
        check(
          await db
            .from("academy_lessons")
            .select("id,title,course_id")
            .order("order")
            .order("id"),
        ) || []
      const cs =
        check(await db.from("academy_courses").select("id,title")) || []
      if (!lessons.length) {
        await say("Avval admin panelida kurs va dars yarating.", home)
        return true
      }
      const row = check(
        await db
          .from("bot_media_uploads")
          .upsert(
            {
              update_id: update.update_id,
              admin_tg: tg,
              file_id: m.video.file_id,
              file_unique_id: m.video.file_unique_id,
              duration: m.video.duration || 0,
              file_size: m.video.file_size || 0,
              choices: lessons.map((l) => ({
                id: l.id,
                label: `${cs.find((c) => c.id === l.course_id)?.title || ""} • ${l.title}`,
              })),
            },
            { onConflict: "update_id", ignoreDuplicates: true },
          )
          .select("*")
          .maybeSingle(),
      )
      // A replayed upsert with ignoreDuplicates can return no row.
      await choices(
        row ||
          check(
            await db
              .from("bot_media_uploads")
              .select("*")
              .eq("update_id", update.update_id)
              .single(),
          ),
      )
      return true
    }
    if (!q) return false
    if (d === "home") {
      await say("🏠 Yukla GO — kerakli bo‘limni tanlang.", home)
      return true
    }
    if (d === "courses") {
      await courses()
      return true
    }
    if (d.startsWith("course:")) {
      const c = check(
        await db
          .from("academy_courses")
          .select("*")
          .eq("bot_key", d.slice(7))
          .eq("active", true)
          .maybeSingle(),
      )
      if (!c) {
        await courses()
        return true
      }
      const a = check(
        await db
          .from("academy_access")
          .select("status")
          .eq("user_id", user.id)
          .eq("course_id", c.id)
          .maybeSingle(),
      )
      if (a?.status !== "granted") {
        await say(
          `💳 ${e(c.title)}\nTo‘lovni admin tekshiradi.`,
          keyboard([
            [
              {
                text: "Kursga ruxsat so‘rash",
                callback_data: `request:${c.bot_key}`,
              },
            ],
          ]),
        )
        return true
      }
      const ls =
        check(
          await db
            .from("academy_lessons")
            .select("*")
            .eq("course_id", c.id)
            .order("order")
            .order("id"),
        ) || []
      await say(
        ls.length
          ? `🎓 ${e(c.title)}\nDarslar ketma-ket ochiladi.`
          : "Darslar hali qo‘shilmagan.",
        keyboard(
          ls.map((l) => [
            { text: l.title, callback_data: `play:${l.bot_key}` },
          ]),
        ),
      )
      return true
    }
    if (d.startsWith("request:")) {
      const c = check(
        await db
          .from("academy_courses")
          .select("id")
          .eq("bot_key", d.slice(8))
          .eq("active", true)
          .maybeSingle(),
      )
      if (c) q.data = `req:${c.id}`
      return !c
    }
    if (d.startsWith("play:") || d.startsWith("done:")) {
      await lesson(d.slice(5), d.startsWith("done:"))
      return true
    }
    if (d.startsWith("bind:") || d.startsWith("media:")) {
      if (!admin) return true
      const [action, id, index] = d.split(":")
      const upload = check(
        await db
          .from("bot_media_uploads")
          .select("*")
          .eq("id", id)
          .eq("admin_tg", tg)
          .maybeSingle(),
      )
      if (!upload) {
        await say("Video yozuvi topilmadi. Videoni qayta yuboring.")
        return true
      }
      if (action === "media") {
        await choices(upload, Number(index) || 0)
        return true
      }
      const target = upload.choices?.[Number(index)]
      if (!target) return true
      const result = await db.rpc("yukla_bind_video", {
        p_upload: id,
        p_admin: tg,
        p_lesson: target.id,
      })
      await say(
        result.error
          ? "Biriktirilmadi. Video avval boshqa darsga biriktirilgan bo‘lishi mumkin."
          : "✅ Video darsga biriktirildi.",
        home,
      )
      return true
    }
    return false
  }
  return { courses, handle }
}
