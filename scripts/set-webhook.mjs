const {
  BOT_TOKEN,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET,
  MINI_APP_URL,
  BACKEND_URL,
} = process.env
const token = BOT_TOKEN || TELEGRAM_BOT_TOKEN
if (!token || !TELEGRAM_WEBHOOK_SECRET || !(BACKEND_URL || MINI_APP_URL))
  throw new Error(
    "BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET va BACKEND_URL talab qilinadi",
  )
const url = new URL("/api/bot/webhook", BACKEND_URL || MINI_APP_URL).href
if (!url.startsWith("https://")) throw new Error("HTTPS URL talab qilinadi")
const response = await fetch(
  `https://api.telegram.org/bot${token}/setWebhook`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: TELEGRAM_WEBHOOK_SECRET,
      max_connections: 1,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    }),
  },
)
const data = await response.json()
if (!data.ok)
  throw new Error("Webhook o‘rnatilmadi. Token va URL ni tekshiring.")
console.log("Webhook muvaffaqiyatli o‘rnatildi.")

// Remove an existing Web App menu button; the frozen code remains deployed.
const menu = await fetch(
  `https://api.telegram.org/bot${token}/setChatMenuButton`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ menu_button: { type: "commands" } }),
  },
)
if (!(await menu.json()).ok)
  throw new Error(
    "Bot menyusini yangilash bajarilmadi. BotFather menyusini tekshiring.",
  )
