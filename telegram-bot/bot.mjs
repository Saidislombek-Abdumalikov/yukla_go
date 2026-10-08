// Production uses /api/bot/webhook. Do not run polling alongside the webhook.
console.error('Bot webhook orqali ishlaydi. SETUP-UZ.md ko‘rsatmalarini bajaring.');
process.exitCode=1;
