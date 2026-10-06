import assert from 'node:assert/strict';

process.env.BOT_TOKEN = '123456:TEST_BOT_TOKEN';
process.env.JWT_SECRET = 'x'.repeat(48);
delete process.env.SUPABASE_URL;
// never hit the real Telegram API from tests
(globalThis as any).fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

const { createFakeSupabase } = await import('./helpers/fakeSupabase.ts');
const { signInitData, mockReqRes } = await import('./helpers/telegram.ts');
const { setSupabaseForTests } = await import('../api/_lib/supabase.ts');
const { createSessionToken, verifySessionToken } = await import('../api/_lib/auth.ts');
const { default: authSession } = await import('../api/_handlers/authSession.ts');
const { default: academyCourses } = await import('../api/_handlers/academyCourses.ts');
const { default: academyProgress } = await import('../api/_handlers/academyProgress.ts');
const { default: requestAccess } = await import('../api/_handlers/academyRequestAccess.ts');
const { default: adminAcademy } = await import('../api/_handlers/adminAcademy.ts');
const { default: userMe } = await import('../api/_handlers/userMe.ts');
const { default: adminUsers } = await import('../api/_handlers/adminUsers.ts');

const db = createFakeSupabase();
db.seedAcademy();
setSupabaseForTests(db);

const ADMIN_TG = 7232597769;
const call = async (handler: any, opts: any) => {
  const { req, res, out } = mockReqRes(opts);
  await handler(req, res);
  return out;
};
const login = async (tgId: number, name = 'User') => {
  const initData = signInitData(process.env.BOT_TOKEN!, { id: tgId, first_name: name });
  const out = await call(authSession, { method: 'POST', body: { initData } });
  return out;
};
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

console.log('--- STARTING ACADEMY + AUTH SECURITY TESTS ---');

// ---------------------------------------------------------------- AUTH
console.log('[TEST 1] Login only works with a valid Telegram signature');
{
  assert.equal((await call(authSession, { method: 'POST', body: {} })).status, 400);
  assert.equal((await call(authSession, { method: 'POST', body: { initData: 'user=%7B%22id%22%3A1%7D&hash=abc&auth_date=1' } })).status, 401);
  // signed with the WRONG bot token
  const forged = signInitData('999:WRONG', { id: ADMIN_TG, first_name: 'Hacker' });
  assert.equal((await call(authSession, { method: 'POST', body: { initData: forged } })).status, 401);
  // expired
  const old = signInitData(process.env.BOT_TOKEN!, { id: 5, first_name: 'Old' }, Math.floor(Date.now() / 1000) - 3 * 86400);
  assert.equal((await call(authSession, { method: 'POST', body: { initData: old } })).status, 401);
  console.log('  ✓ missing / forged / expired initData all rejected');
}

console.log('[TEST 2] The old admin-key backdoor is gone');
{
  for (const key of ['yukla2026', 'yukla_admin_2026', String(ADMIN_TG), process.env.JWT_SECRET!]) {
    const out = await call(authSession, { method: 'POST', body: { adminKey: key } });
    assert.equal(out.status, 401, `adminKey "${key.slice(0, 8)}" must not log in`);
    assert.equal(out.body.token, undefined);
  }
  console.log('  ✓ hardcoded keys, admin IDs and JWT secret no longer grant admin');
}

console.log('[TEST 3] Roles come from the verified Telegram ID');
const customerLogin = await login(111111111, 'Ali');
const customer2Login = await login(222222222, 'Vali');
const adminLogin = await login(ADMIN_TG, 'Boss');
{
  assert.equal(customerLogin.status, 200);
  assert.equal(customerLogin.body.user.role, 'customer');
  assert.equal(adminLogin.body.user.role, 'super_admin');
  assert.equal(db.tables.users.length, 3);
  console.log('  ✓ customer -> customer, whitelisted Telegram ID -> super_admin');
}

console.log('[TEST 4] No JWT secret => no sessions (no default secret)');
{
  const saved = process.env.JWT_SECRET;
  process.env.JWT_SECRET = '';
  assert.throws(() => createSessionToken({ userId: 'x', telegramUserId: 1, customerCode: 'A', role: 'customer' }));
  process.env.JWT_SECRET = saved;
  const forgedToken = (await import('jsonwebtoken')).default.sign(
    { userId: 'x', telegramUserId: ADMIN_TG, customerCode: 'ADMIN', role: 'super_admin' },
    'yukla_go_dev_secret_replace_in_prod'
  );
  assert.equal(verifySessionToken(`Bearer ${forgedToken}`), null);
  console.log('  ✓ tokens signed with the old default secret are rejected');
}

// --------------------------------------------------------- ACCESS CONTROL
const C = bearer(customerLogin.body.token);
const C2 = bearer(customer2Login.body.token);
const A = bearer(adminLogin.body.token);

console.log('[TEST 5] Unauthenticated requests are rejected everywhere');
{
  assert.equal((await call(academyCourses, { query: {} })).status, 401);
  assert.equal((await call(academyCourses, { query: { courseId: 'course_cargo_101' } })).status, 401);
  assert.equal((await call(academyProgress, { method: 'POST', body: { lessonId: 'les_1', watchedSeconds: 5 } })).status, 401);
  assert.equal((await call(requestAccess, { method: 'POST', body: { courseId: 'course_cargo_101' } })).status, 401);
  assert.equal((await call(adminAcademy, { query: {} })).status, 401);
  assert.equal((await call(adminAcademy, { method: 'POST', body: { action: 'grant_access', identifier: '111111111' } })).status, 401);
  console.log('  ✓ no token => 401 on every academy and admin endpoint');
}

console.log('[TEST 6] Customers cannot use admin endpoints');
{
  assert.equal((await call(adminAcademy, { headers: C, query: {} })).status, 403);
  assert.equal((await call(adminAcademy, { headers: C, method: 'POST', body: { action: 'grant_access', identifier: '111111111' } })).status, 403);
  assert.equal((await call(adminUsers, { headers: C })).status, 403);
  console.log('  ✓ customer token => 403 on admin endpoints');
}

console.log('[TEST 7] No access => no video IDs');
{
  const out = await call(academyCourses, { headers: C, query: { courseId: 'course_cargo_101' } });
  assert.equal(out.status, 200);
  assert.equal(out.body.hasAccess, false);
  assert.deepEqual(out.body.lessons, []);
  assert.ok(!JSON.stringify(out.body).includes('VIDEOID'));
  console.log('  ✓ locked-out user receives zero lessons and zero video IDs');
}

console.log('[TEST 8] Request -> admin grants -> only that user gets in');
{
  const req1 = await call(requestAccess, { headers: C, method: 'POST', body: { courseId: 'course_cargo_101', telegramUserId: ADMIN_TG, customerCode: 'ADMIN', name: 'spoof' } });
  assert.equal(req1.status, 200);
  assert.equal(req1.body.item.status, 'pending');
  assert.equal(req1.body.item.telegramUserId, 111111111, 'identity comes from session, not body');
  assert.equal((await call(academyCourses, { headers: C, query: { courseId: 'course_cargo_101' } })).body.hasAccess, false);

  const grant = await call(adminAcademy, { headers: A, method: 'POST', body: { action: 'grant_access', identifier: '111111111' } });
  assert.equal(grant.status, 200);
  assert.equal(grant.body.item.status, 'granted');

  assert.equal((await call(academyCourses, { headers: C, query: { courseId: 'course_cargo_101' } })).body.hasAccess, true);
  assert.equal((await call(academyCourses, { headers: C2, query: { courseId: 'course_cargo_101' } })).body.hasAccess, false);
  assert.equal(db.tables.admin_audit_logs.some(l => l.action === 'ACADEMY_GRANT'), true);
  console.log('  ✓ grant affects only the chosen student and is audit-logged');
}

console.log('[TEST 9] Sequential unlock: video ID only for unlocked lessons');
{
  const out = await call(academyCourses, { headers: C, query: { courseId: 'course_cargo_101' } });
  const [l1, l2, l3] = out.body.lessons;
  assert.equal(l1.isLocked, false);
  assert.ok(l1.youtubeVideoId.startsWith('VIDEOID'));
  assert.equal(l2.isLocked, true);
  assert.equal(l2.youtubeVideoId, '');
  assert.equal(l3.youtubeVideoId, '');
  console.log('  ✓ locked lessons never leak their video ID');
}

console.log('[TEST 10] Progress: locked lessons rejected, skip-ahead clamped, unlock works');
{
  const locked = await call(academyProgress, { headers: C, method: 'POST', body: { lessonId: 'les_2', watchedSeconds: 100, completed: true } });
  assert.equal(locked.status, 403);
  const noAccess = await call(academyProgress, { headers: C2, method: 'POST', body: { lessonId: 'les_1', watchedSeconds: 100, completed: true } });
  assert.equal(noAccess.status, 403);

  // Jump straight to the end of a 100s lesson on the first ping: must be clamped
  const jump = await call(academyProgress, { headers: C, method: 'POST', body: { lessonId: 'les_1', watchedSeconds: 100, completed: true } });
  assert.equal(jump.status, 200);
  assert.ok(jump.body.progress.maxWatchedSeconds <= 25, `jump clamped (got ${jump.body.progress.maxWatchedSeconds})`);
  assert.equal(jump.body.progress.completed, false);

  // Simulate real viewing time having passed, then finish
  const row = db.tables.academy_user_progress[0];
  row.last_sync_timestamp = new Date(Date.now() - 120_000).toISOString();
  const done = await call(academyProgress, { headers: C, method: 'POST', body: { lessonId: 'les_1', watchedSeconds: 100, completed: true } });
  assert.equal(done.body.progress.completed, true);
  assert.equal(done.body.unlockedNextLesson, true);

  const after = await call(academyCourses, { headers: C, query: { courseId: 'course_cargo_101' } });
  assert.equal(after.body.lessons[1].isLocked, false);
  assert.ok(after.body.lessons[1].youtubeVideoId.startsWith('VIDEOID'));
  console.log('  ✓ anti-skip and sequential unlocking enforced on the server');
}

console.log('[TEST 11] Progress is per-user and stored in the database');
{
  assert.equal(db.tables.academy_user_progress.every(p => p.user_id === customerLogin.body.user.id), true);
  const list = await call(academyCourses, { headers: C });
  assert.equal(list.body[0].completedLessonsCount, 1);
  console.log('  ✓ state lives in the DB (survives serverless cold starts)');
}

console.log('[TEST 12] Sessions for deleted / blocked users stop working');
{
  const ghost = createSessionToken({ userId: '00000000-0000-4000-8000-000000000000', telegramUserId: 333, customerCode: 'YK-9', role: 'customer' });
  assert.equal((await call(academyCourses, { headers: bearer(ghost) })).status, 401);

  db.tables.users.find(u => u.telegram_user_id === 222222222)!.status = 'blocked';
  assert.equal((await call(academyCourses, { headers: C2 })).status, 403);
  assert.equal((await login(222222222)).status, 403);
  console.log('  ✓ unknown user => 401, blocked user => 403 (even with a valid token)');
}

console.log('[TEST 13] Admin content management + input safety');
{
  const course = await call(adminAcademy, { headers: A, method: 'POST', body: { action: 'create_course', title: 'Yangi bo\'lim' } });
  assert.equal(course.status, 201);
  const cid = course.body.course.id;
  const bad = await call(adminAcademy, { headers: A, method: 'POST', body: { action: 'add_lesson', courseId: cid, title: 'x', youtubeUrlOrId: 'not a video' } });
  assert.equal(bad.status, 400);
  const good = await call(adminAcademy, { headers: A, method: 'POST', body: { action: 'add_lesson', courseId: cid, title: 'Dars', youtubeUrlOrId: 'https://youtu.be/dQw4w9WgXcQ' } });
  assert.equal(good.status, 201);
  assert.equal(good.body.lesson.youtubeVideoId, 'dQw4w9WgXcQ');
  const inj = await call(adminAcademy, { headers: A, method: 'POST', body: { action: 'grant_access', identifier: 'x),role.eq.admin' } });
  assert.equal(inj.status, 404);
  const del = await call(adminAcademy, { headers: A, method: 'DELETE', query: { courseId: cid } });
  assert.equal(del.body.success, true);
  assert.equal(db.tables.academy_lessons.some(l => l.course_id === cid), false);
  console.log('  ✓ create / validate / delete work; filter-injection style input finds nothing');
}

console.log('[TEST 14] Database down => login refused (no fake sessions)');
{
  setSupabaseForTests(null);
  const out = await login(444444444);
  assert.equal(out.status, 503);
  assert.equal(out.body.token, undefined);
  setSupabaseForTests(db);
  console.log('  ✓ fails closed with 503');
}

console.log('[TEST 15] Same Telegram account => same profile, every time, from the server');
{
  const first = await login(111111111, 'Ali');
  const second = await login(111111111, 'Totally Different Name From A Link');
  assert.equal(first.body.user.id, second.body.user.id);
  assert.equal(first.body.user.customerCode, second.body.user.customerCode);
  assert.equal(db.tables.users.filter(u => u.telegram_user_id === 111111111).length, 1, 'no duplicate accounts');

  const me = await call(userMe, { headers: bearer(second.body.token) });
  assert.equal(me.status, 200);
  assert.equal(me.body.customerCode, first.body.user.customerCode);
  assert.equal(me.body.telegramUserId, 111111111);

  const adminMe = await call(userMe, { headers: bearer((await login(ADMIN_TG)).body.token) });
  assert.equal(adminMe.body.telegramUserId, ADMIN_TG);
  assert.notEqual(adminMe.body.customerCode, me.body.customerCode);

  const ghost = createSessionToken({ userId: '00000000-0000-4000-8000-000000000000', telegramUserId: 9, customerCode: 'YK-0', role: 'customer' });
  assert.equal((await call(userMe, { headers: bearer(ghost) })).status, 401);
  console.log('  ✓ one Telegram ID = one account; no made-up fallback profile');
}

console.log('--- ALL ACADEMY + AUTH SECURITY TESTS PASSED! ---');
