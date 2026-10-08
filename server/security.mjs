import { createHmac, timingSafeEqual, randomBytes } from "node:crypto"
export const check = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}
export function equal(a, b) {
  const x = Buffer.from(String(a || "")),
    y = Buffer.from(String(b || ""))
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y)
}
export const admins = () =>
  (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0)
export const escapeHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  )
function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters")
  return s
}
export function signSession(payload) {
  const b = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 8 * 3600,
      nonce: randomBytes(12).toString("hex"),
    }),
  ).toString("base64url")
  return b + "." + createHmac("sha256", secret()).update(b).digest("base64url")
}
export function readSession(token) {
  try {
    const [b, s, ...extra] = String(token || "").split(".")
    if (
      extra.length ||
      !equal(s, createHmac("sha256", secret()).update(b).digest("base64url"))
    )
      return null
    const p = JSON.parse(Buffer.from(b, "base64url"))
    return p.exp > Date.now() / 1000 ? p : null
  } catch {
    return null
  }
}
export function telegramIdentity(raw, token) {
  try {
    const p = new URLSearchParams(raw || "")
    const h = p.get("hash")
    p.delete("hash")
    const time = Number(p.get("auth_date"))
    if (
      !time ||
      Date.now() / 1000 - time > 3600 ||
      time > Date.now() / 1000 + 30
    )
      return null
    const key = createHmac("sha256", "WebAppData").update(token).digest()
    const sig = createHmac("sha256", key)
      .update(
        [...p.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join("\n"),
      )
      .digest("hex")
    if (!equal(h, sig)) return null
    const u = JSON.parse(p.get("user"))
    return Number.isSafeInteger(u.id) ? u : null
  } catch {
    return null
  }
}
export async function ensureStudent(db, from) {
  let user = check(
    await db
      .from("users")
      .select("*")
      .eq("telegram_user_id", from.id)
      .maybeSingle(),
  )
  if (!user) {
    check(
      await db
        .from("users")
        .upsert(
          {
            telegram_user_id: from.id,
            name:
              [from.first_name, from.last_name].filter(Boolean).join(" ") ||
              "Talaba",
            phone: "",
            customer_code: `YK_PENDING_${from.id}`,
            onboarding_completed: false,
            onboarding_step: "oferta",
            status: "active",
          },
          { onConflict: "telegram_user_id", ignoreDuplicates: true },
        ),
    )
    user = check(
      await db
        .from("users")
        .select("*")
        .eq("telegram_user_id", from.id)
        .single(),
    )
  }
  return user
}
export function addressFields(code) {
  if (!/^YK-?\d+$/.test(code)) throw new Error("Unapproved cargo ID")
  return {
    recipient: "真RC-554",
    phone: "18922155990",
    address: `广州市白云区龙归街道南村三姓十巷3号一楼档口 RC-554(${code})`,
  }
}
