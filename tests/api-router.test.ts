import assert from 'assert';
import handler from '../api/index.ts';

// Mock VercelRequest and VercelResponse
function createMockReqRes(url: string, method: string = 'GET', body: any = null, query: any = {}) {
  const req: any = {
    url,
    method,
    headers: {},
    query,
    body,
  };

  let statusCode = 200;
  let responseData: any = null;

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    send(data: any) {
      responseData = data;
      return res;
    },
    setHeader() {
      return res;
    },
    getStatus: () => statusCode,
    getData: () => responseData,
  };

  return { req, res };
}

async function runRouterTests() {
  console.log('--- STARTING UNIFIED API ROUTER TESTS ---');

  // Test 1: Unknown path returns 404
  {
    const { req, res } = createMockReqRes('/api/unknown-endpoint');
    await handler(req, res);
    assert.strictEqual(res.getStatus(), 404, 'Unknown endpoint should return 404');
    console.log('  ✓ Unknown path correctly returns 404');
  }

  // Test 2: /api/branches returns branches list
  {
    const { req, res } = createMockReqRes('/api/branches');
    await handler(req, res);
    assert.strictEqual(res.getStatus(), 200, 'Branches endpoint should return 200');
    assert.ok(Array.isArray(res.getData()), 'Branches should be an array');
    console.log('  ✓ /api/branches routed and returned 200 array');
  }

  // Test 3: /api?__path=branches rewrite path parameter works
  {
    const { req, res } = createMockReqRes('/api?__path=branches', 'GET', null, { __path: 'branches' });
    await handler(req, res);
    assert.strictEqual(res.getStatus(), 200, 'Rewritten branches endpoint should return 200');
    assert.ok(Array.isArray(res.getData()), 'Rewritten branches should return array');
    console.log('  ✓ /api?__path=branches rewrite successfully dispatched to branches handler');
  }

  // Test 4: /api/config/rates returns shipping rates
  {
    const { req, res } = createMockReqRes('/api/config/rates');
    await handler(req, res);
    assert.strictEqual(res.getStatus(), 200, 'Rates endpoint should return 200');
    assert.ok(res.getData().pricePerKg !== undefined, 'Rates should include pricePerKg');
    console.log('  ✓ /api/config/rates routed and returned rates data');
  }

  // Test 5: /api/academy/courses returns courses
  {
    const { req, res } = createMockReqRes('/api/academy/courses');
    await handler(req, res);
    assert.strictEqual(res.getStatus(), 200, 'Academy courses endpoint should return 200');
    assert.ok(Array.isArray(res.getData()), 'Academy courses should return array');
    console.log('  ✓ /api/academy/courses routed and returned courses list');
  }

  // Test 6: /api/bot/webhook with GET returns 405 Method Not Allowed
  {
    const { req, res } = createMockReqRes('/api/bot/webhook', 'GET');
    await handler(req, res);
    assert.strictEqual(res.getStatus(), 405, 'Webhook GET should return 405');
    console.log('  ✓ /api/bot/webhook routed and rejected GET with 405');
  }

  // Test 7: /api/bot/webhook with empty POST returns 200 ok: true
  {
    const { req, res } = createMockReqRes('/api/bot/webhook', 'POST', {});
    await handler(req, res);
    assert.strictEqual(res.getStatus(), 200, 'Webhook POST should return 200');
    assert.strictEqual(res.getData().ok, true, 'Webhook POST should return ok: true');
    console.log('  ✓ /api/bot/webhook routed and handled POST update correctly');
  }

  console.log('--- ALL UNIFIED API ROUTER TESTS PASSED! ---');
}

runRouterTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
