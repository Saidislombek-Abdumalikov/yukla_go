import test from "node:test"
import assert from "node:assert/strict"
import { botUpdate } from "../server/bot.mjs"
function database() {
  const tables = {
    users: [],
    cargo_applications: [],
    academy_courses: [
      { id: "course-a", title: "Test", active: true, order: 1 },
    ],
    academy_access: [],
  }
  return {
    tables,
    from(table) {
      let filters = [],
        mode = "select",
        value,
        options = {},
        single = false
      const query = {
        select() {
          return query
        },
        eq(k, v) {
          filters.push((r) => String(r[k]) === String(v))
          return query
        },
        order() {
          return query
        },
        maybeSingle() {
          single = true
          return query
        },
        single() {
          single = true
          return query
        },
        upsert(v, o = {}) {
          mode = "upsert"
          value = v
          options = o
          return query
        },
        update(v) {
          mode = "update"
          value = v
          return query
        },
        then(resolve, reject) {
          try {
            const rows = tables[table]
            if (!rows) throw Error(table)
            let result = rows.filter((r) => filters.every((f) => f(r)))
            if (mode === "upsert") {
              const keys = (options.onConflict || "telegram_user_id").split(",")
              let row = rows.find((r) => keys.every((k) => r[k] === value[k]))
              if (!row) {
                row = { id: `${table}-${rows.length + 1}`, ...value }
                rows.push(row)
              } else if (!options.ignoreDuplicates) Object.assign(row, value)
              result = [row]
            }
            if (mode === "update")
              result.forEach((r) => Object.assign(r, value))
            return Promise.resolve({
              data: single ? result[0] || null : result,
              error: null,
            }).then(resolve, reject)
          } catch (e) {
            return Promise.reject(e).then(resolve, reject)
          }
        },
      }
      return query
    },
    rpc(name, p) {
      if (name !== "yukla_save_application") throw Error("Unexpected RPC")
      let a = tables.cargo_applications.find(
        (a) => a.telegram_user_id === p.p_tg,
      )
      if (!a) {
        a = { telegram_user_id: p.p_tg }
        tables.cargo_applications.push(a)
      }
      Object.assign(a, {
        step: p.p_step,
        status: p.p_status,
        data: p.p_data,
        last_update_id: p.p_update,
      })
      return Promise.resolve({ data: true, error: null })
    },
  }
}
test("pasport-free menu/course request, persisted document flow, own-contact check and copy buttons", async () => {
  process.env.ADMIN_TELEGRAM_IDS = "99"
  process.env.OFERTA_URL = "https://example.com/oferta"
  process.env.MINI_APP_URL = "https://example.com/app"
  const db = database(),
    messages = []
  let id = 0
  const call = async (method, p) => {
    messages.push({ method, ...p })
    return { ok: true }
  }
  const send = async (text, extra = {}, tg = 1) =>
    botUpdate(
      {
        update_id: ++id,
        message: {
          message_id: id,
          chat: { id: tg, type: "private" },
          from: { id: tg, first_name: "Test" },
          text,
          ...extra,
        },
      },
      db,
      call,
    )
  const callback = async (data, tg = 1) =>
    botUpdate(
      {
        update_id: ++id,
        callback_query: {
          id: String(id),
          data,
          from: { id: tg, first_name: "Test" },
          message: { chat: { id: tg, type: "private" } },
        },
      },
      db,
      call,
    )
  await send("/start")
  assert.equal(db.tables.users[0].onboarding_completed, false)
  assert.equal(db.tables.users[0].customer_code, "YK_PENDING_1")
  await send("🎓 Video darslar")
  assert.equal(db.tables.cargo_applications.length, 0)
  assert(!messages.some((m) => JSON.stringify(m).includes("web_app")))
  await callback("req:course-a")
  assert.equal(db.tables.academy_access[0].status, "pending")
  await send("🆔 ID olish")
  await send("✅ Roziman")
  await send("", { contact: { user_id: 2, phone_number: "998900000000" } })
  assert.equal(db.tables.cargo_applications[0].step, "phone")
  await send("", { contact: { user_id: 1, phone_number: "998900000000" } })
  for (const s of ["Test", "User", "AA1234567", "12345678901234", "Namangan"])
    await send(s)
  assert.equal(db.tables.cargo_applications[0].step, "photo_front")
  await send("", { photo: [{ file_id: "front" }] })
  await send("", { photo: [{ file_id: "back" }] })
  assert.equal(db.tables.cargo_applications[0].step, "confirm")
  await send("✅ Tasdiqlash")
  assert.equal(db.tables.cargo_applications[0].status, "pending")
  assert(
    messages.some(
      (m) =>
        m.chat_id === 99 &&
        m.reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data ===
          "approve:1",
    ),
  )
  const before = messages.length
  await send("✅ Tasdiqlash")
  assert(messages.length > before) // persisted retry still notifies admin
  Object.assign(db.tables.users[0], {
    onboarding_completed: true,
    customer_code: "YK12",
  })
  await send("🇨🇳 Ombor manzili")
  const addr = messages.at(-1)
  assert.equal(
    addr.reply_markup.inline_keyboard[1][0].copy_text.text,
    "广州市白云区龙归街道南村三姓十巷3号一楼档口 RC-554(YK12)",
  )
  await callback("grant:" + db.tables.academy_access[0].id, 99)
  assert.equal(db.tables.academy_access[0].status, "granted")
})
test("failed prompt replay does not write first name into surname; expired callback and sticker are non-blocking", async () => {
  process.env.ADMIN_TELEGRAM_IDS = "99"
  process.env.OFERTA_URL = "https://example.com/oferta"
  process.env.WELCOME_STICKER_FILE_ID = "test-sticker"
  const db = database(),
    events = []
  let updateId = 500,
    fail = false
  const call = async (method, p) => {
    events.push({ method, ...p })
    if (
      method === "sendSticker" ||
      method === "answerCallbackQuery" ||
      (fail && p.text?.includes("Familiyangiz"))
    )
      throw Error("network")
  }
  const message = (text) => ({
    update_id: ++updateId,
    message: {
      message_id: updateId,
      from: { id: 1, first_name: "Test" },
      chat: { id: 1, type: "private" },
      text,
    },
  })
  await botUpdate(message("/start"), db, call)
  assert(events.some((e) => e.text?.includes("Yukla GO")))
  await botUpdate(message("🆔 ID olish"), db, call)
  await botUpdate(message("✅ Roziman"), db, call)
  const contact = message("")
  contact.message.contact = { user_id: 1, phone_number: "998900000000" }
  await botUpdate(contact, db, call)
  const name = message("Said")
  fail = true
  await assert.rejects(botUpdate(name, db, call))
  assert.equal(db.tables.cargo_applications[0].step, "last_name")
  fail = false
  await botUpdate(name, db, call)
  assert.equal(db.tables.cargo_applications[0].step, "last_name")
  assert.equal(db.tables.cargo_applications[0].data.last_name, undefined)
  await botUpdate(
    {
      update_id: ++updateId,
      callback_query: {
        id: "old",
        data: "courses",
        from: { id: 1 },
        message: { chat: { id: 1, type: "private" } },
      },
    },
    db,
    call,
  )
  delete process.env.WELCOME_STICKER_FILE_ID
})
