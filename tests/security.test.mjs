import test from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import {
  signSession,
  readSession,
  telegramIdentity,
  addressFields,
} from "../server/security.mjs"
import handler from "../api/index.js"
process.env.SESSION_SECRET = "test-only-secret-not-for-production-123456789"
process.env.SUPABASE_URL = "https://example.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key"
test("session rejects tampering and separates roles", () => {
  const token = signSession({ role: "student", uid: "test" })
  assert.equal(readSession(token).role, "student")
  assert.equal(readSession(token + "x"), null)
  assert.equal(readSession(""), null)
})
test("Telegram identity requires signed, recent initData", () => {
  const p = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 123, first_name: "Test" }),
  })
  const token = "test:token"
  const key = createHmac("sha256", "WebAppData").update(token).digest()
  const hash = createHmac("sha256", key)
    .update(
      [...p.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n"),
    )
    .digest("hex")
  p.set("hash", hash)
  assert.equal(telegramIdentity(p.toString(), token).id, 123)
  p.set("user", JSON.stringify({ id: 999 }))
  assert.equal(telegramIdentity(p.toString(), token), null)
  assert.equal(telegramIdentity('user={"id":123}', token), null)
})
test("address preserves upstream identity and places YK only at the end", () => {
  assert.deepEqual(addressFields("YK12001"), {
    recipient: "真RC-554",
    phone: "18922155990",
    address: "广州市白云区龙归街道南村三姓十巷3号一楼档口 RC-554(YK12001)",
  })
  assert.throws(() => addressFields("YK_PENDING_1"))
})
function response() {
  return {
    code: 0,
    data: null,
    setHeader() {},
    status(code) {
      this.code = code
      return this
    },
    json(data) {
      this.data = data
      return this
    },
    end() {},
  }
}
test("admin mutations and user data reject anonymous HTTP requests", async () => {
  for (const path of [
    "users/delete",
    "users/access",
    "state",
    "upload/sign",
    "user",
  ]) {
    const res = response()
    await handler(
      { url: "/api/" + path, method: "POST", headers: {}, body: {} },
      res,
    )
    assert.equal(res.code, 401, path)
  }
})
test("webhook requires secret, including when header is missing", async () => {
  process.env.TELEGRAM_WEBHOOK_SECRET = "test-webhook"
  const res = response()
  await handler(
    {
      url: "/api/bot/webhook",
      method: "POST",
      headers: {},
      body: { update_id: 1 },
    },
    res,
  )
  assert.equal(res.code, 401)
})
test("student tokens cannot call any admin endpoint, old Mini App sessions are frozen", async () => {
  const token = signSession({ role: "student", uid: "test" })
  for (const path of [
    "users/delete",
    "users/access",
    "courses/add",
    "courses/update",
    "courses/delete",
    "lessons/add",
    "lessons/update",
    "lessons/delete",
    "lessons",
    "settings",
    "upload/sign",
    "state",
    "progress",
  ]) {
    const res = response()
    await handler(
      {
        url: "/api/" + path,
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: {},
      },
      res,
    )
    assert.equal(res.code, 403, path)
  }
  const res = response()
  await handler(
    { url: "/api/auth/telegram", method: "POST", headers: {}, body: {} },
    res,
  )
  assert.equal(res.code, 403)
})
