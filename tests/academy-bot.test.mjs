import test from "node:test"
import assert from "node:assert/strict"
import { academyBot } from "../server/academy-bot.mjs"
const key = "11111111-1111-4111-8111-111111111111"
function fixture({ failure = false, denied = false, admin = false } = {}) {
  const events = [],
    rows = {
      academy_lessons: [{ id: "lesson", title: "Dars", course_id: "course" }],
      academy_courses: [{ id: "course", title: "Kurs" }],
      bot_media_uploads: [],
    }
  const db = {
    rpc: async (name, p) => {
      events.push({ name, p })
      return denied
        ? { error: { message: "denied" } }
        : {
            data: {
              id: "lesson",
              bot_key: key,
              title: "Dars",
              telegram_file_id: "file".repeat(400),
            },
            error: null,
          }
    },
    from(t) {
      let val,
        one = false
      const q = {
        select() {
          return q
        },
        eq() {
          return q
        },
        order() {
          return q
        },
        maybeSingle() {
          one = true
          return q
        },
        single() {
          one = true
          return q
        },
        upsert(v) {
          val = v
          return q
        },
        then(resolve) {
          if (val) {
            rows[t] = [{ id: key, ...val }]
          }
          return Promise.resolve({
            data: one ? rows[t][0] : rows[t],
            error: null,
          }).then(resolve)
        },
      }
      return q
    },
  }
  const api = academyBot({
    db,
    user: { id: "user" },
    tg: 1,
    admin,
    home: { keyboard: [] },
    say: async (text, reply_markup) =>
      events.push({ name: "say", text, reply_markup }),
    call: async (name, p) => {
      events.push({ name, p })
      if (failure && name === "sendVideo") throw Error("network")
      return { ok: true }
    },
  })
  return { api, events, rows }
}
test("video reuses long file_id with protected content; callbacks are short", async () => {
  const { api, events } = fixture()
  await api.handle({ callback_query: { data: `play:${key}` } })
  assert.equal(events[0].name, "yukla_lesson_action")
  const video = events.find((e) => e.name === "sendVideo")
  assert(video.p.protect_content)
  assert.equal(video.p.video, "file".repeat(400))
  for (const row of video.p.reply_markup.inline_keyboard)
    for (const button of row)
      assert(Buffer.byteLength(button.callback_data) <= 64)
})
test("completion persists before send; network failure offers retry of actual successor", async () => {
  const { api, events } = fixture({ failure: true })
  await api.handle({ callback_query: { data: `done:${key}` } })
  assert.equal(events[0].p.p_complete, true)
  assert.equal(events[1].name, "sendVideo")
  assert.equal(
    events[2].reply_markup.inline_keyboard[0][0].callback_data,
    `play:${key}`,
  )
})
test("revoked and out-of-order access cannot send any video", async () => {
  const { api, events } = fixture({ denied: true })
  await api.handle({ callback_query: { data: `done:${key}` } })
  assert(!events.some((e) => e.name === "sendVideo"))
})
test("2GB metadata stays in DB; binding callback references a short upload ID", async () => {
  const { api, events, rows } = fixture({ admin: true })
  const file = "large-file-".repeat(100)
  await api.handle({
    update_id: 456,
    message: {
      video: {
        file_id: file,
        file_unique_id: "unique",
        duration: 5400,
        file_size: 2147483648,
      },
    },
  })
  assert.equal(rows.bot_media_uploads[0].file_id, file)
  assert.equal(rows.bot_media_uploads[0].file_size, 2147483648)
  const callback =
    events.at(-1).reply_markup.inline_keyboard[0][0].callback_data
  assert.equal(callback, `bind:${key}:0`)
  assert(Buffer.byteLength(callback) <= 64)
  assert(!events.some((e) => e.name === "getFile"))
})
test("non-admin media cannot attach to a lesson", async () => {
  const { api, rows } = fixture()
  await api.handle({ message: { video: { file_id: "x" } } })
  assert.equal(rows.bot_media_uploads.length, 0)
})
