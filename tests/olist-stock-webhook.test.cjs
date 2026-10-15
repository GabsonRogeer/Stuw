const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');

test('stock webhook requires a secret, matches both identities and only schedules a trusted read', async (t) => {
  const before = {
    secret: process.env.OLIST_STOCK_WEBHOOK_SECRET,
    enabled: process.env.OLIST_ENABLED,
  };
  t.after(() => {
    for (const [key, val] of [
      ['OLIST_STOCK_WEBHOOK_SECRET', before.secret],
      ['OLIST_ENABLED', before.enabled],
    ]) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });
  process.env.OLIST_ENABLED = 'true';
  process.env.OLIST_STOCK_WEBHOOK_SECRET = 'test-secret-which-is-at-least-thirty-two-characters';
  let reads = 0;
  const writes = [];
  const { POST } = loadTypeScript('src/app/api/webhooks/olist/stock/route.ts', {
    'server-only': {},
    '@/lib/supabase/service': {
      createServiceClient: () => ({
        from: () => {
          const q = {
            select: () => q,
            eq: () => q,
            maybeSingle: async () => {
              reads++;
              return { data: { sku: 'STUW-P' } };
            },
            update: (v) => {
              writes.push(v);
              return q;
            },
            then: (resolve) => Promise.resolve({ error: null }).then(resolve),
          };
          return q;
        },
      }),
    },
  });
  const request = (key, body) =>
    new Request(`https://stuw.test/api/webhooks/olist/stock?key=${key}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  const body = { tipo: 'estoque', dados: { idProduto: 123, sku: 'STUW-P', saldo: 99999 } };
  assert.equal((await POST(request('wrong', body))).status, 401);
  assert.equal(reads, 0);
  assert.equal((await POST(request(process.env.OLIST_STOCK_WEBHOOK_SECRET, body))).status, 200);
  assert.deepEqual(writes, [{ next_check_at: new Date(0).toISOString() }]);
  assert.equal(
    (await POST(request(process.env.OLIST_STOCK_WEBHOOK_SECRET, { ...body, tipo: 'outro' })))
      .status,
    400,
  );
});
