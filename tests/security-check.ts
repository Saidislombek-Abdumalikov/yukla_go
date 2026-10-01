import crypto from 'crypto';
import assert from 'assert';
import { validateTelegramInitData, createSessionToken, verifySessionToken } from '../api/_lib/auth.ts';
import { checkRateLimit } from '../api/_lib/rateLimiter.ts';
import { TrackingNumberSchema, AddParcelsPayloadSchema } from '../api/_lib/validation.ts';

async function runSecurityTests() {
  console.log('--- STARTING YUKLA GO SECURITY AUDIT ---');

  // Set mock BOT_TOKEN for test
  process.env.BOT_TOKEN = '123456789:TEST_BOT_TOKEN_FOR_SECURITY_CHECK';
  const botToken = process.env.BOT_TOKEN;

  // 1. TELEGRAM HMAC SIGNATURE TEST
  console.log('[TEST 1] Telegram HMAC-SHA256 Signature Verification');

  const authDate = Math.floor(Date.now() / 1000);
  const userJson = JSON.stringify({ id: 987654321, first_name: 'TestUser', username: 'testuser' });

  // Generate valid signature according to Telegram specification
  const dataParams: Record<string, string> = {
    auth_date: String(authDate),
    query_id: 'AAHdF6IQAAAAAN0XohD9p3m0',
    user: userJson,
  };

  const sortedKeys = Object.keys(dataParams).sort();
  const dataCheckString = sortedKeys.map(k => `${k}=${dataParams[k]}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const validHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const validInitData = `auth_date=${authDate}&query_id=${dataParams.query_id}&user=${encodeURIComponent(userJson)}&hash=${validHash}`;

  // Test 1.1: Valid initData must succeed
  const validResult = validateTelegramInitData(validInitData);
  assert.strictEqual(validResult.valid, true, 'Valid initData should pass verification');
  assert.strictEqual(validResult.user?.id, 987654321, 'User ID must match verified payload');
  console.log('  ✓ Valid Telegram initData passes verification');

  // Test 1.2: Tampered hash must fail
  const tamperedHash = validHash.slice(0, -4) + '0000';
  const tamperedHashData = `auth_date=${authDate}&query_id=${dataParams.query_id}&user=${encodeURIComponent(userJson)}&hash=${tamperedHash}`;
  const tamperedHashResult = validateTelegramInitData(tamperedHashData);
  assert.strictEqual(tamperedHashResult.valid, false, 'Tampered hash must fail');
  console.log('  ✓ Tampered hash correctly rejected');

  // Test 1.3: Tampered user ID with valid hash must fail
  const tamperedUserJson = JSON.stringify({ id: 111111111, first_name: 'Attacker' });
  const tamperedUserData = `auth_date=${authDate}&query_id=${dataParams.query_id}&user=${encodeURIComponent(tamperedUserJson)}&hash=${validHash}`;
  const tamperedUserResult = validateTelegramInitData(tamperedUserData);
  assert.strictEqual(tamperedUserResult.valid, false, 'Tampered payload with unmatching hash must fail');
  console.log('  ✓ Tampered user data correctly rejected');

  // Test 1.4: Expired auth_date (> 600s) must fail
  const oldAuthDate = Math.floor(Date.now() / 1000) - 1000;
  const expiredDataCheck = `auth_date=${oldAuthDate}\nquery_id=${dataParams.query_id}\nuser=${userJson}`;
  const expiredHash = crypto.createHmac('sha256', secretKey).update(expiredDataCheck).digest('hex');
  const expiredInitData = `auth_date=${oldAuthDate}&query_id=${dataParams.query_id}&user=${encodeURIComponent(userJson)}&hash=${expiredHash}`;
  const expiredResult = validateTelegramInitData(expiredInitData, 600);
  assert.strictEqual(expiredResult.valid, false, 'Expired auth_date must fail');
  console.log('  ✓ Expired auth_date correctly rejected');

  // 2. JWT SESSION TOKEN TEST
  console.log('\n[TEST 2] Short-Lived JWT Session Tokens');
  const sessionPayload = {
    userId: 'usr_uuid_123',
    telegramUserId: 987654321,
    customerCode: 'YK-100',
    role: 'customer' as const,
  };

  const token = createSessionToken(sessionPayload, '10s');
  assert.ok(token && typeof token === 'string', 'Token must be issued');

  // Test 2.1: Valid token verification
  const verified = verifySessionToken(`Bearer ${token}`);
  assert.strictEqual(verified?.userId, 'usr_uuid_123');
  assert.strictEqual(verified?.customerCode, 'YK-100');
  assert.strictEqual(verified?.role, 'customer');
  console.log('  ✓ Valid session token verified');

  // Test 2.2: Tampered token verification
  const tamperedToken = token + 'manipulated';
  const tamperedVerify = verifySessionToken(`Bearer ${tamperedToken}`);
  assert.strictEqual(tamperedVerify, null, 'Tampered token must return null');
  console.log('  ✓ Tampered token rejected');

  // Test 2.3: Missing Bearer header
  const noBearer = verifySessionToken('Token abc');
  assert.strictEqual(noBearer, null, 'Missing Bearer prefix must return null');
  console.log('  ✓ Invalid auth header format rejected');

  // 3. RATE LIMITING TEST
  console.log('\n[TEST 3] Serverless Rate Limiting');
  const testIpKey = 'test_ip_12345';
  for (let i = 0; i < 5; i++) {
    const rl = checkRateLimit(testIpKey, 5, 60);
    assert.strictEqual(rl.allowed, true, `Request ${i + 1} should be allowed`);
  }
  // 6th request should be blocked
  const blockedRl = checkRateLimit(testIpKey, 5, 60);
  assert.strictEqual(blockedRl.allowed, false, '6th request must exceed limit');
  assert.strictEqual(blockedRl.remaining, 0, 'Remaining requests must be 0');
  console.log('  ✓ Rate limiter blocks excessive requests');

  // 4. INPUT VALIDATION & INJECTION TEST
  console.log('\n[TEST 4] Input Validation & Injection Protection');

  // Valid tracking numbers
  assert.strictEqual(TrackingNumberSchema.safeParse('YT882910291CN').success, true);
  assert.strictEqual(TrackingNumberSchema.safeParse('SF1029384756').success, true);
  console.log('  ✓ Valid tracking numbers accepted');

  // Malformed & Injection tracking numbers
  assert.strictEqual(TrackingNumberSchema.safeParse('<script>alert(1)</script>').success, false, 'XSS input rejected');
  assert.strictEqual(TrackingNumberSchema.safeParse("'; DROP TABLE parcels; --").success, false, 'SQL injection characters rejected');
  assert.strictEqual(TrackingNumberSchema.safeParse('AB').success, false, 'Too short tracking rejected');
  assert.strictEqual(TrackingNumberSchema.safeParse('A'.repeat(70)).success, false, 'Oversized tracking rejected');
  console.log('  ✓ Malformed tracking numbers and injection attempts rejected');

  // Bulk limits
  const oversizedBulk = Array.from({ length: 35 }, (_, i) => `YT${i}12345CN`);
  assert.strictEqual(AddParcelsPayloadSchema.safeParse({ trackingNumbers: oversizedBulk }).success, false, 'Oversized bulk submission rejected');
  console.log('  ✓ Max 30 bulk items limit enforced');

  console.log('\n--- ALL SECURITY TESTS PASSED SUCCESSFULLY! ---');
}

runSecurityTests().catch(err => {
  console.error('SECURITY TEST FAILED:', err);
  process.exit(1);
});
