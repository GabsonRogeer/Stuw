const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  testEnvironment,
  assertTestPayment,
  signedNotification,
  jsonRequest,
} = require('../scripts/lib/checkout-homologation.cjs');
const { loadTypeScript: load } = require('../scripts/lib/load-typescript.cjs');
const { runCommerceJob } = require('../scripts/lib/commerce-job.cjs');

test('manual job refuses production or missing secrets before contacting the server', async () => {
  for (const env of [
    { MERCADO_PAGO_ENVIRONMENT: 'production' },
    {
      MERCADO_PAGO_ENVIRONMENT: 'test',
      MELHOR_ENVIO_ENVIRONMENT: 'sandbox',
      NEXT_PUBLIC_SITE_URL: 'https://example.test',
    },
    {
      MERCADO_PAGO_ENVIRONMENT: 'test',
      MELHOR_ENVIO_ENVIRONMENT: 'sandbox',
      NEXT_PUBLIC_SITE_URL: 'https://example.test',
      CRON_SECRET: '[SENSITIVE]',
    },
  ]) {
    await assert.rejects(runCommerceJob(env, () => assert.fail('Must not contact server')));
  }
});

test('manual job uses authentication, refuses redirects and reports partial failures', async () => {
  const env = {
    MERCADO_PAGO_ENVIRONMENT: 'test',
    MELHOR_ENVIO_ENVIRONMENT: 'sandbox',
    NEXT_PUBLIC_SITE_URL: 'https://example.test',
    CRON_SECRET: 'test-secret',
  };
  const result = await runCommerceJob(env, async (url, init) => {
    assert.equal(url, 'https://example.test/api/jobs/commerce');
    assert.equal(init.headers.Authorization, 'Bearer test-secret');
    assert.equal(init.redirect, 'error');
    return Response.json({ processed: 3, failed: 1, privateData: 'must-not-return' });
  });
  assert.deepEqual(result, { processed: 3, failed: 1 });
  await assert.rejects(
    runCommerceJob(env, async () => Response.json({ processed: 1, failed: 2 })),
    /Resposta inesperada/,
  );
  await assert.rejects(
    runCommerceJob(env, async () => new Response('private error', { status: 401 })),
    /^Error: Job recusado: HTTP 401\.$/,
  );
});

test('homologation tools refuse production, unsafe origins and live or unrelated payments', () => {
  const env = {
    MERCADO_PAGO_ENVIRONMENT: 'test',
    MELHOR_ENVIO_ENVIRONMENT: 'sandbox',
    NEXT_PUBLIC_SITE_URL: 'https://stuw.example',
  };
  assert.equal(testEnvironment(env).origin, 'https://stuw.example');
  for (const patch of [
    { MERCADO_PAGO_ENVIRONMENT: 'production' },
    { MELHOR_ENVIO_ENVIRONMENT: 'production' },
    { NEXT_PUBLIC_SITE_URL: 'http://stuw.example' },
    { NEXT_PUBLIC_SITE_URL: 'https://secret@stuw.example' },
    { NEXT_PUBLIC_SITE_URL: 'https://stuw.example/path' },
  ])
    assert.throws(() => testEnvironment({ ...env, ...patch }));
  const order = {
    id: 'order',
    is_demo: false,
    payment_test_mode: true,
    total_cents: 10000,
    payment_method: 'pix',
  };
  const payment = {
    live_mode: false,
    collector_id: 123,
    external_reference: 'order',
    currency_id: 'BRL',
    transaction_amount: 100,
    payment_method_id: 'pix',
  };
  assert.doesNotThrow(() => assertTestPayment(payment, order, '123'));
  for (const patch of [
    { live_mode: true },
    { live_mode: null },
    { collector_id: 999 },
    { external_reference: 'other' },
    { transaction_amount: 1 },
    { currency_id: 'USD' },
    { payment_method_id: 'visa' },
  ])
    assert.throws(() => assertTestPayment({ ...payment, ...patch }, order, '123'));
  for (const patch of [{ is_demo: true }, { payment_test_mode: false }])
    assert.throws(() => assertTestPayment(payment, { ...order, ...patch }, '123'));
});

test('replay signs a fresh notification accepted by the actual verifier, and expired/tampered signatures fail', () => {
  const mp = load('src/lib/integrations/mercado-pago.ts', {
    'server-only': {},
    './http': {},
    './config': { requiredEnv: () => 'sandbox-secret' },
  });
  const now = Date.now();
  const { headers } = signedNotification('123', 'sandbox-secret', now);
  assert.equal(mp.validPaymentSignature(new Headers(headers), '123', now), true);
  assert.equal(mp.validPaymentSignature(new Headers(headers), '456', now), false);
  assert.equal(mp.validPaymentSignature(new Headers(headers), '123', now + 601000), false);
});

test('diagnostic HTTP does not follow redirects or expose a provider error body', async () => {
  await assert.rejects(
    jsonRequest('https://example.test', {}, async (_url, init) => {
      assert.equal(init.redirect, 'error');
      assert.ok(init.signal instanceof AbortSignal);
      return new Response('secret-provider-error', { status: 403 });
    }),
    /^Error: Consulta recusada: HTTP 403\.$/,
  );
});
