const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(file, deps = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const loaded = new Module(filename);
  loaded.require = (name) => {
    if (name === 'server-only') return {};
    if (name.startsWith('node:')) return require(name);
    if (name in deps) return deps[name];
    throw new Error('Unexpected import ' + name);
  };
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return loaded.exports;
}
const fulfillment = load('src/services/fulfillment.ts');
const config = {
  shippingConfig: () => ({
    production: false,
    token: 'test-secret',
    contact: 'dev@example.com',
    postalCode: '01001000',
  }),
  commerceConfig: () => ({ origin: 'https://stuw.example', production: false }),
  requiredEnv: (name) => (name === 'MERCADO_PAGO_COLLECTOR_ID' ? '123' : 'test-secret'),
};
test('provider errors preserve safe machine codes without leaking credentials, documents or response messages', async () => {
  const { integrationRequest, IntegrationError } = load('src/lib/integrations/http.ts');
  const originalFetch = global.fetch;
  try {
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          error: 'unauthorized',
          message: 'secret-access-token',
          cause: [
            { code: 7, description: 'secret-access-token', data: 'payer@example.com' },
            { code: '7' },
            { code: '12345678909' },
            { code: 'secret-access-token' },
            null,
          ],
        }),
        { status: 401 },
      );
    await assert.rejects(
      () => integrationRequest('Mercado Pago', 'https://example.test', {}),
      (error) => {
        assert.ok(error instanceof IntegrationError);
        assert.equal(error.status, 401);
        assert.deepEqual(error.codes, ['unauthorized', '7']);
        assert.ok(!JSON.stringify(error).includes('secret-access-token'));
        assert.ok(!JSON.stringify(error).includes('payer@example.com'));
        assert.ok(!JSON.stringify(error).includes('12345678909'));
        return true;
      },
    );
    global.fetch = async () => new Response('<html>bad gateway</html>', { status: 502 });
    await assert.rejects(
      () => integrationRequest('Mercado Pago', 'https://example.test', {}),
      (error) =>
        error instanceof IntegrationError && error.status === 502 && error.codes.length === 0,
    );
    global.fetch = async () => {
      throw new TypeError('network failure');
    };
    await assert.rejects(
      () => integrationRequest('Mercado Pago', 'https://example.test', {}),
      (error) => !(error instanceof IntegrationError),
    );
  } finally {
    global.fetch = originalFetch;
  }
});
test('shipping configuration works without payment activation, HTTPS or a service key and reports only missing names', () => {
  const keys = [
    'COMMERCE_ENABLED',
    'NEXT_PUBLIC_SITE_URL',
    'MERCADO_PAGO_ENVIRONMENT',
    'SUPABASE_SERVICE_ROLE_KEY',
    'MELHOR_ENVIO_ENVIRONMENT',
    'MELHOR_ENVIO_TOKEN',
    'MELHOR_ENVIO_CONTACT_EMAIL',
    'MELHOR_ENVIO_ORIGIN_POSTAL_CODE',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, {
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      MELHOR_ENVIO_ENVIRONMENT: 'sandbox',
      MELHOR_ENVIO_TOKEN: 'sensitive-token',
      MELHOR_ENVIO_CONTACT_EMAIL: 'dev@example.com',
      MELHOR_ENVIO_ORIGIN_POSTAL_CODE: '01001-000',
    });
    const settings = load('src/lib/integrations/config.ts');
    assert.equal(settings.shippingConfig().postalCode, '01001000');
    assert.equal(settings.shippingConfig().production, false);
    assert.throws(() => settings.commerceConfig(), /checkout/);
    process.env.MELHOR_ENVIO_CONTACT_EMAIL = '';
    process.env.MELHOR_ENVIO_ORIGIN_POSTAL_CODE = '12';
    assert.throws(
      () => settings.shippingConfig(),
      (error) => {
        assert.deepEqual(error.fields, [
          'MELHOR_ENVIO_CONTACT_EMAIL',
          'MELHOR_ENVIO_ORIGIN_POSTAL_CODE',
        ]);
        assert.ok(!error.message.includes('sensitive-token'));
        return true;
      },
    );
  } finally {
    for (const key of keys)
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
  }
});

test('local checkout requires explicit opt-in and sandbox without inferring environment from credential prefixes', () => {
  const values = {
    COMMERCE_ENABLED: 'true',
    ALLOW_LOCAL_CHECKOUT_TEST: 'true',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    MERCADO_PAGO_ENVIRONMENT: 'test',
    MELHOR_ENVIO_ENVIRONMENT: 'sandbox',
    MERCADO_PAGO_ACCESS_TOKEN: 'TEST-private',
    NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: 'TEST-public',
    MERCADO_PAGO_COLLECTOR_ID: '123',
    MERCADO_PAGO_WEBHOOK_SECRET: 'private-secret',
    SUPABASE_SERVICE_ROLE_KEY: 'private-key',
    MELHOR_ENVIO_TOKEN: 'private-shipping',
    MELHOR_ENVIO_CONTACT_EMAIL: 'dev@example.com',
    MELHOR_ENVIO_ORIGIN_POSTAL_CODE: '01001000',
  };
  const prior = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  const settings = load('src/lib/integrations/config.ts');
  try {
    Object.assign(process.env, values);
    assert.equal(settings.commerceConfig().localTest, true);
    Object.assign(process.env, {
      MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-test-account-private',
      NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: 'APP_USR-test-account-public',
    });
    assert.deepEqual(settings.commerceConfig(), {
      origin: 'http://localhost:3000',
      production: false,
      localTest: true,
    });
    for (const [patch, code] of [
      [{ COMMERCE_ENABLED: 'false' }, 'CHECKOUT_DISABLED'],
      [{ ALLOW_LOCAL_CHECKOUT_TEST: 'false' }, 'HTTPS_REQUIRED'],
      [{ NEXT_PUBLIC_SITE_URL: 'http://example.com' }, 'HTTPS_REQUIRED'],
      [{ NEXT_PUBLIC_SITE_URL: 'http://localhost.example.com' }, 'HTTPS_REQUIRED'],
      [{ NEXT_PUBLIC_SITE_URL: 'https://user:password@example.com' }, 'HTTPS_REQUIRED'],
      [{ MERCADO_PAGO_ACCESS_TOKEN: ' ' }, 'MISSING_CREDENTIALS'],
      [{ NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: '' }, 'MISSING_CREDENTIALS'],
      [{ MERCADO_PAGO_WEBHOOK_SECRET: '' }, 'MISSING_CREDENTIALS'],
      [
        { MERCADO_PAGO_ENVIRONMENT: 'production', MELHOR_ENVIO_ENVIRONMENT: 'production' },
        'HTTPS_REQUIRED',
      ],
    ]) {
      Object.assign(process.env, values, patch);
      assert.throws(
        () => settings.commerceConfig(),
        (error) => error.code === code && !error.message.includes('private'),
      );
    }
    Object.assign(process.env, values, {
      NEXT_PUBLIC_SITE_URL: 'https://stuw.example',
      MERCADO_PAGO_ENVIRONMENT: 'production',
      MELHOR_ENVIO_ENVIRONMENT: 'production',
      MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-production',
    });
    assert.equal(settings.commerceConfig().localTest, false);
    assert.equal(settings.commerceConfig().production, true);
  } finally {
    for (const k of Object.keys(values))
      if (prior[k] === undefined) delete process.env[k];
      else process.env[k] = prior[k];
  }
});

test('test packaging fills only missing dimensions and preserves existing product data', () => {
  const { withTestShippingPackage } = load('src/services/shipping-package.ts');
  const initial = { weight: 450, length: null, width: 24, height: null, price: 200, sizes: ['M'] };
  assert.deepEqual(withTestShippingPackage(initial), {
    ...initial,
    length: 30,
    height: 5,
    shippingPackageIsTest: true,
  });
  assert.equal(initial.length, null);
  const complete = { ...initial, length: 30, height: 5 };
  assert.deepEqual(withTestShippingPackage(complete), complete);
});

test('admin freight simulation enforces authorization, validates dimensions and converts grams without creating orders', async () => {
  const settings = load('src/lib/integrations/config.ts');
  const http = load('src/lib/integrations/http.ts');
  let authorized = false;
  let production = false;
  let calls = 0;
  let fail;
  const actions = load('src/app/admin/produtos/shipping.ts', {
    '@/lib/supabase/admin': {
      requireAdmin: async () => {
        if (!authorized) throw new Error('Denied');
      },
    },
    '@/lib/integrations/config': { ...settings, shippingConfig: () => ({ production }) },
    '@/lib/integrations/http': http,
    '@/lib/integrations/melhor-envio': {
      calculateShipping: async (cep, products) => {
        calls++;
        if (fail) throw fail;
        assert.equal(cep, '01001000');
        assert.equal(products[0].weight, 0.3);
        return [{ id: 'me:1', name: 'PAC', price: 20, deliveryEstimate: '5 dias' }];
      },
    },
  });
  const input = {
    postalCode: '01001-000',
    weight: 300,
    length: 30,
    width: 20,
    height: 5,
    price: 100,
    isTestPackage: true,
  };
  assert.match((await actions.testProductShipping(input)).error, /administrativo/);
  assert.equal(calls, 0);
  authorized = true;
  assert.ok((await actions.testProductShipping({ ...input, weight: -1 })).error);
  assert.equal(calls, 0);
  assert.equal((await actions.testProductShipping(input)).options.length, 1);
  production = true;
  assert.match((await actions.testProductShipping(input)).error, /medidas reais/);
  assert.equal(calls, 1);
  production = false;
  fail = new http.IntegrationError('Melhor Envio', 401);
  assert.match((await actions.testProductShipping(input)).error, /HTTP 401/);
  fail = new settings.ConfigurationError(['MELHOR_ENVIO_TOKEN']);
  assert.match((await actions.testProductShipping(input)).error, /MELHOR_ENVIO_TOKEN/);
});

test('Mercado Pago signatures authenticate resource, timestamp and request id', () => {
  const mp = load('src/lib/integrations/mercado-pago.ts', { './config': config, './http': {} });
  const now = Date.now();
  const ts = String(now);
  const id = '321';
  const request = 'request-1';
  const v1 = crypto
    .createHmac('sha256', 'test-secret')
    .update(`id:${id};request-id:${request};ts:${ts};`)
    .digest('hex');
  const headers = new Headers({ 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': request });
  assert.equal(mp.validPaymentSignature(headers, id, now), true);
  assert.equal(mp.validPaymentSignature(headers, '999', now), false);
  assert.equal(mp.validPaymentSignature(headers, id, now + 601000), false);
  assert.equal(mp.validPaymentSignature(new Headers(), id, now), false);
});
test('payment requests use authoritative order amount, fixed idempotency and allowlisted card fields', async () => {
  let captured;
  let localTest = false;
  const mp = load('src/lib/integrations/mercado-pago.ts', {
    './config': { ...config, commerceConfig: () => ({ ...config.commerceConfig(), localTest }) },
    './http': {
      integrationRequest: async (_provider, url, init) => {
        if (url.endsWith('/payment_methods'))
          return [{ id: 'visa', payment_type_id: 'credit_card' }];
        captured = init;
        return { id: 123 };
      },
    },
  });
  const order = {
    id: 'order-id',
    number: 'STUW-1',
    payment_method: 'card',
    installments: 2,
    total_cents: 14990,
    customer_email: 'verified@example.com',
    items: [],
  };
  await mp.createPayment(order, '52998224725', {
    token: 'secure-token',
    payment_method_id: 'visa',
    issuer_id: '1',
    installments: 2,
    transaction_amount: 1,
    payer: { email: 'untrusted@example.com' },
    card_number: '4111111111111111',
  });
  const body = JSON.parse(captured.body);
  assert.equal(body.transaction_amount, 149.9);
  assert.equal(body.payer.email, 'verified@example.com');
  assert.equal(body.card_number, undefined);
  assert.equal(body.external_reference, 'order-id');
  assert.equal(captured.headers['X-Idempotency-Key'], 'order-id');
  assert.equal(body.notification_url, 'https://stuw.example/api/webhooks/mercado-pago');
  localTest = true;
  await mp.createPayment(
    { ...order, payment_method: 'pix', payment_expires_at: '2030-01-01T00:00:00Z' },
    '52998224725',
  );
  assert.equal(Object.hasOwn(JSON.parse(captured.body), 'notification_url'), false);
  assert.equal(captured.headers['X-Idempotency-Key'], 'order-id');
  await assert.rejects(
    mp.createPayment(order, '52998224725', { payment_method_id: 'debit' }),
    /crédito/,
  );
});
test('shipping quotes filter unavailable and malformed services, preserve carrier price and kg units', async () => {
  let captured;
  const me = load('src/lib/integrations/melhor-envio.ts', {
    './config': {
      ...config,
      requiredEnv: (name) => (name === 'MELHOR_ENVIO_ORIGIN_POSTAL_CODE' ? '01001000' : 'secret'),
    },
    '@/services/fulfillment': fulfillment,
    './http': {
      integrationRequest: async (_provider, url, init) => {
        captured = { url, body: JSON.parse(init.body) };
        return [
          {
            id: 1,
            name: 'PAC',
            company: { name: 'Correios' },
            custom_price: '23.47',
            price: '25.00',
            delivery_range: { min: 3, max: 5 },
          },
          { id: 2, name: 'SEDEX', error: 'unavailable' },
          { id: 3, name: 'Invalid', price: 'NaN', delivery_range: { min: 3, max: 5 } },
        ];
      },
    },
  });
  const options = await me.calculateShipping('20000000', [
    { id: 'SKU', width: 20, height: 4, length: 30, weight: 0.3, quantity: 2, insurance_value: 100 },
  ]);
  assert.equal(options.length, 1);
  assert.equal(options[0].price, 23.47);
  assert.equal(options[0].id, 'me:1');
  assert.equal(captured.body.products[0].weight, 0.3);
  assert.match(captured.url, /sandbox/);
});
test('shipping stages reflect actual provider evidence, not just purchased labels', () => {
  assert.equal(fulfillment.shippingStatus({ status: 'released' }), 'pending');
  assert.equal(
    fulfillment.shippingStatus({ status: 'released', tracking: 'BR123' }),
    'label_generated',
  );
  assert.equal(fulfillment.shippingStatus({ status: 'posted' }), 'in_transit');
  assert.equal(fulfillment.shippingStatus({ status: 'delivered' }), 'delivered');
  assert.equal(fulfillment.shippingStatus({ status: 'undelivered' }), 'exception');
});
test('payment confirmation rejects wrong amount, collector, mode, currency and payment method before writing', async () => {
  let writes = 0;
  const order = {
    id: 'order',
    is_demo: false,
    total_cents: 10000,
    payment_method: 'pix',
    payment_test_mode: true,
  };
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    async maybeSingle() {
      return { data: order };
    },
  };
  const integration = load('src/lib/integrations/checkout.ts', {
    '@/lib/supabase/service': {
      createServiceClient: () => ({
        from: () => query,
        rpc: async () => {
          writes++;
          return {};
        },
      }),
    },
    '@/services/checkout-integration': {},
    '@/services/fulfillment': fulfillment,
    './config': config,
    './melhor-envio': {},
    './mercado-pago': {},
    '@/lib/commerce': { FREE_SHIPPING_THRESHOLD: 499 },
  });
  const payment = {
    id: 321,
    external_reference: 'order',
    status: 'approved',
    transaction_amount: 100,
    currency_id: 'BRL',
    collector_id: 123,
    live_mode: false,
    payment_method_id: 'pix',
    date_last_updated: '2026-10-12T12:00:00Z',
  };
  for (const patch of [
    { transaction_amount: 1 },
    { collector_id: 999 },
    { live_mode: true },
    { currency_id: 'USD' },
    { payment_method_id: 'visa' },
  ])
    await assert.rejects(integration.applyPayment({ ...payment, ...patch }), /divergente/);
  assert.equal(writes, 0);
  await integration.applyPayment(payment);
  assert.equal(writes, 1);
});
test('webhook rejects unsigned notifications before requesting any payment', async () => {
  let fetched = false;
  const route = load('src/app/api/webhooks/mercado-pago/route.ts', {
    '@/lib/integrations/mercado-pago': {
      validPaymentSignature: () => false,
      getPayment: () => {
        fetched = true;
      },
    },
    '@/lib/integrations/checkout': {},
  });
  const response = await route.POST(
    new Request('https://stuw.example/api/webhooks/mercado-pago?data.id=321', {
      method: 'POST',
      body: '{}',
    }),
  );
  assert.equal(response.status, 401);
  assert.equal(fetched, false);
});
