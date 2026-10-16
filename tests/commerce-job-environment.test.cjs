const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');

test('commerce worker selects only real orders from its configured payment environment', async (t) => {
  const original = process.env.CRON_SECRET;
  t.after(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });
  process.env.CRON_SECRET = 'controlled-test-secret';
  for (const production of [true, false]) {
    const filters = [];
    const synced = [];
    let reading = true;
    const fixtures = [
      { order_id: 'live', orders: { payment_test_mode: false, is_demo: false } },
      { order_id: 'test', orders: { payment_test_mode: true, is_demo: false } },
      { order_id: 'demo', orders: { payment_test_mode: false, is_demo: true } },
    ];
    const db = {
      from() {
        const query = {
          select() {
            return query;
          },
          eq(key, value) {
            if (reading) filters.push([key, value]);
            return query;
          },
          lt() {
            return query;
          },
          order() {
            return query;
          },
          limit() {
            return query;
          },
          update() {
            reading = false;
            return query;
          },
          maybeSingle: async () => ({ data: { order_id: 'claimed' }, error: null }),
          then(resolve) {
            return Promise.resolve({
              data: fixtures.filter((row) =>
                filters.every(([key, value]) => row.orders[key.split('.')[1]] === value),
              ),
              error: null,
            }).then(resolve);
          },
        };
        return query;
      },
    };
    const { GET } = loadTypeScript('src/app/api/jobs/commerce/route.ts', {
      '@/lib/supabase/service': { createServiceClient: () => db },
      '@/lib/integrations/config': { commerceConfig: () => ({ production }) },
      '@/lib/integrations/checkout': {
        syncOrderPayment: async (id) => synced.push(id),
        syncOrderShipment() {},
      },
    });
    const response = await GET(
      new Request('https://example.com/api/jobs/commerce', {
        headers: { authorization: 'Bearer controlled-test-secret' },
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(synced, [production ? 'live' : 'test']);
    const unauthorized = await GET(new Request('https://example.com/api/jobs/commerce'));
    assert.equal(unauthorized.status, 401);
  }
});
