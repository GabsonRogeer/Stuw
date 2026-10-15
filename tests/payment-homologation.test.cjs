const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript: load } = require('../scripts/lib/load-typescript.cjs');
const { signedNotification } = require('../scripts/lib/checkout-homologation.cjs');

test('actual HTTP adapter aborts an unavailable provider; it never retries a payment POST', async (t) => {
  const { integrationRequest } = load('src/lib/integrations/http.ts', { 'server-only': {} });
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(AbortSignal, 'timeout', (ms) => {
    assert.equal(ms, 15000);
    return controller.signal;
  });
  t.mock.method(global, 'fetch', async (_url, init) => {
    calls++;
    assert.equal(init.method, 'POST');
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      // Advance the simulated timeout immediately; no real network or sleep.
      controller.abort(new DOMException('Simulated timeout', 'TimeoutError'));
    });
  });
  await assert.rejects(
    integrationRequest('Mercado Pago', 'https://api.mercadopago.com/v1/payments', {
      method: 'POST',
    }),
    { name: 'TimeoutError' },
  );
  assert.equal(calls, 1);
});

test('webhook verifies real signatures, fetches authoritative status, rejects forgery and recovers after provider timeout', async () => {
  let unavailable = true;
  let reads = 0;
  const applied = [];
  const mp = load('src/lib/integrations/mercado-pago.ts', {
    'server-only': {},
    './config': { requiredEnv: () => 'sandbox-secret' },
    './http': {
      integrationRequest: async (_provider, url) => {
        reads++;
        assert.equal(url, 'https://api.mercadopago.com/v1/payments/123');
        if (unavailable) throw new DOMException('Simulated timeout', 'TimeoutError');
        return { id: 123, status: 'pending' };
      },
    },
  });
  const route = load('src/app/api/webhooks/mercado-pago/route.ts', {
    '@/lib/integrations/mercado-pago': mp,
    '@/lib/integrations/checkout': {
      applyPayment: async (payment) => applied.push(payment.status),
    },
  });
  const signed = signedNotification('123', 'sandbox-secret');
  const request = (overrides = {}) =>
    new Request('https://stuw.example/api/webhooks/mercado-pago?data.id=123', {
      method: 'POST',
      ...signed,
      ...overrides,
    });
  assert.equal((await route.POST(request({ headers: {} }))).status, 401);
  assert.equal(reads, 0);
  assert.equal((await route.POST(request())).status, 503);
  assert.deepEqual(applied, []);
  unavailable = false;
  assert.equal(
    (
      await route.POST(
        request({
          body: JSON.stringify({ type: 'payment', data: { id: '123' }, status: 'approved' }),
        }),
      )
    ).status,
    200,
  );
  assert.deepEqual(applied, ['pending'], 'forged body status cannot approve a payment');
  assert.equal(
    (await route.POST(request({ body: JSON.stringify({ type: 'payment', data: { id: '999' } }) })))
      .status,
    400,
  );
  assert.equal(reads, 2);
});

test('reconciliation finds a payment whose creation response was lost; missing payment remains pending', async () => {
  const order = {
    id: 'order',
    is_demo: false,
    total_cents: 10000,
    payment_method: 'pix',
    payment_test_mode: true,
  };
  const integration = { payment_id: null };
  const writes = [];
  const scheduled = [];
  let payments = [];
  const db = {
    from: (table) => {
      const query = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({ data: integration }),
        maybeSingle: async () => ({ data: order }),
        update(value) {
          scheduled.push({ table, ...value });
          return this;
        },
      };
      return query;
    },
    rpc: async (name, args) => {
      writes.push({ name, args });
      return {};
    },
  };
  const runtime = load('src/lib/integrations/checkout.ts', {
    'server-only': {},
    '@/lib/supabase/service': { createServiceClient: () => db },
    '@/services/checkout-integration': {},
    '@/services/fulfillment': load('src/services/fulfillment.ts'),
    '@/lib/commerce': { FREE_SHIPPING_THRESHOLD: 499 },
    './melhor-envio': {},
    './config': { commerceConfig: () => ({ production: false }), requiredEnv: () => '123' },
    './mercado-pago': {
      findOrderPayments: async (reference) => {
        assert.equal(reference, order.id);
        return payments;
      },
      getPayment: async () => assert.fail('no provider payment ID was saved'),
    },
  });
  assert.equal(await runtime.syncOrderPayment(order.id), undefined);
  assert.equal(writes.length, 0, 'no cancellation or stock release without provider evidence');
  assert.ok(scheduled[0].next_sync_at);
  payments = [
    {
      id: 12345,
      external_reference: order.id,
      status: 'approved',
      transaction_amount: 100,
      collector_id: 123,
      live_mode: false,
      currency_id: 'BRL',
      payment_method_id: 'pix',
      date_last_updated: new Date().toISOString(),
    },
  ];
  await runtime.syncOrderPayment(order.id);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].name, 'reconcile_checkout_payment');
  assert.equal(writes[0].args.provider_id, '12345');
  assert.equal(writes[0].args.next_status, 'approved');
});
