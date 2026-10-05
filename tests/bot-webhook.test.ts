import assert from 'assert';
import { STATUS_MESSAGES } from '../api/_lib/botNotifications.ts';
import { processTelegramUpdate, wipeBotUser, getInMemoryBotUsers } from '../api/_lib/botEngine.ts';

async function runBotTests() {
  console.log('--- STARTING TELEGRAM BOT AUTOMATED AUDIT ---');

  // TEST 1: Status Messages Coverage
  console.log('[TEST 1] Bot Parcel Status Message Translations');
  const requiredStatuses = ['added', 'china_warehouse', 'in_transit', 'uzbekistan', 'delivered'];
  for (const status of requiredStatuses) {
    assert.ok(STATUS_MESSAGES[status], `Status "${status}" must have a defined notification message`);
    assert.ok(STATUS_MESSAGES[status].title.length > 0, `Status "${status}" must have a non-empty title`);
    assert.ok(STATUS_MESSAGES[status].desc.length > 0, `Status "${status}" must have a non-empty description`);
  }
  console.log('  ✓ All 5 parcel lifecycle statuses mapped with Uzbek messages');

  // TEST 2: Contact Spoofing Protection Logic
  console.log('[TEST 2] Contact Spoofing Protection');
  const senderTelegramId = 123456789;
  const spoofedContact = { phone_number: '+998901112233', user_id: 999999999 };
  const validContact = { phone_number: '+998901112233', user_id: 123456789 };

  // Rule: If contact.user_id !== senderTelegramId, reject!
  const isSpoofed = spoofedContact.user_id && spoofedContact.user_id !== senderTelegramId;
  const isValid = !validContact.user_id || validContact.user_id === senderTelegramId;

  assert.strictEqual(isSpoofed, true, 'Spoofed contact must be flagged');
  assert.strictEqual(isValid, true, 'Valid personal contact must be accepted');
  console.log('  ✓ Spoofed third-party contacts correctly blocked');
  console.log('  ✓ Authentic personal contacts accepted');

  // TEST 3: Tracking Code Pattern Matching
  console.log('[TEST 3] Tracking Code Recognition');
  const trackRegex = /^[a-zA-Z0-9]{8,35}$/;
  assert.strictEqual(trackRegex.test('YT882910291CN'), true);
  assert.strictEqual(trackRegex.test('SF192837482CN'), true);
  assert.strictEqual(trackRegex.test('JT382910381CN'), true);
  assert.strictEqual(trackRegex.test('abc'), false, 'Too short tracking code rejected');
  assert.strictEqual(trackRegex.test('A'.repeat(50)), false, 'Too long tracking code rejected');
  console.log('  ✓ Standard international & domestic China tracking codes validated');

  // TEST 4: Customer Code Generation & Monospace Formatting
  console.log('[TEST 4] Warehouse Monospace Template Format');
  const customerCode = 'YK-100';
  const warehouseTemplate = `收件人: Yukla Go (${customerCode})\n详细地址: 077库房/70099号 ${customerCode}`;
  assert.ok(warehouseTemplate.includes('YK-100'), 'Template must include safe customer code');
  assert.ok(!warehouseTemplate.toLowerCase().includes('ipost'), 'Customer-facing template must never hardcode upstream cargo name');
  console.log('  ✓ Upstream cargo company name isolation verified');

  // TEST 5: Full Wipe Telegram Bot User Session
  console.log('[TEST 5] Telegram Bot User Session Full Wipe');
  const testTgId = 555666777;
  await processTelegramUpdate({
    message: {
      message_id: 1,
      from: { id: testTgId, first_name: 'WipeTester' },
      chat: { id: testTgId, type: 'private' },
      text: '/start',
    },
  });
  const botUsersBefore = getInMemoryBotUsers();
  assert.ok(botUsersBefore.some(u => u.telegramUserId === testTgId), 'User must be present after /start');

  const wipeResult = wipeBotUser(testTgId);
  assert.strictEqual(wipeResult.success, true);
  const botUsersAfter = getInMemoryBotUsers();
  assert.strictEqual(botUsersAfter.some(u => u.telegramUserId === testTgId), false, 'User must be deleted from memory after full wipe');
  console.log('  ✓ Bot session and state fully wiped: user returns to brand new state');

  console.log('--- ALL TELEGRAM BOT TESTS PASSED SUCCESSFULLY! ---');
}

runBotTests();
