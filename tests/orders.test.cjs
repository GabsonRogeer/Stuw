const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, deps = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const compiledModule = new Module(filename);
  compiledModule.require = (name) => {
    if (name in deps) return deps[name];
    throw new Error('Unexpected import ' + name);
  };
  compiledModule._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );
  return compiledModule.exports;
}
const checkout = load('src/services/checkout.ts');
const orders = load('src/services/orders.ts', { './checkout': checkout });
const integrationDeps = {
  '@/lib/supabase/service': {},
  '@/lib/integrations/config': {
    commerceConfig: () => ({ production: false }),
    CheckoutConfigurationError: class extends Error {},
  },
  '@/lib/integrations/checkout': {
    hash: () => 'hash',
    applyPayment: async () => {},
    paymentResult: (order) => ({
      id: order.id,
      code: order.number,
      total: order.total_cents / 100,
      paymentStatus: order.payment_status,
    }),
  },
  '@/lib/integrations/mercado-pago': {
    createPayment: async () => ({ id: 123, status: 'pending' }),
  },
  '@/lib/integrations/http': { IntegrationError: class extends Error {} },
  '@/services/checkout-integration': load('src/services/checkout-integration.ts'),
};
const request = {
  key: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  information: checkout.DEMO_INFORMATION,
  items: [{ id: 1, size: 'M', color: 'Black', qty: 1 }],
  shipping: 'me:1',
  quoteId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  payment: 'pix',
  installments: 1,
  gift: false,
  giftWrap: false,
  coupon: '',
  expectedTotal: 48400,
  taxDocument: '52998224725',
};
test('order validation rejects malformed or oversized submissions', () => {
  assert.equal(orders.validOrderRequest(request), true);
  for (const patch of [
    { key: 'bad' },
    { information: null },
    { items: [] },
    { items: [{ id: 1, qty: -1 }] },
    { payment: 'free' },
    { installments: 7 },
    { expectedTotal: -1 },
    { taxDocument: '00000000000' },
  ])
    assert.equal(orders.validOrderRequest({ ...request, ...patch }), false);
});
test('checkout refuses unsigned users before any order RPC', async () => {
  const actions = load('src/app/actions/order.ts', {
    ...integrationDeps,
    'next/cache': { revalidatePath() {} },
    '@/services/orders': orders,
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
        rpc: () => {
          throw new Error('Must not write');
        },
      }),
    },
  });
  assert.equal((await actions.placeOrder(request)).loginRequired, true);
});
test('configuration failures are classified before any order or payment and only safe diagnostics are logged', async () => {
  class CheckoutConfigurationError extends Error {
    constructor() {
      super('Checkout não habilitado.');
      this.code = 'CHECKOUT_DISABLED';
      this.fields = ['COMMERCE_ENABLED'];
    }
  }
  const messages = [];
  const priorWarn = console.warn;
  console.warn = (...args) => messages.push(args);
  try {
    const actions = load('src/app/actions/order.ts', {
      ...integrationDeps,
      'next/cache': { revalidatePath() {} },
      '@/services/orders': orders,
      '@/lib/integrations/config': {
        CheckoutConfigurationError,
        commerceConfig: () => {
          throw new CheckoutConfigurationError();
        },
      },
      '@/lib/supabase/server': {
        createClient: async () => ({
          auth: { getUser: async () => ({ data: { user: { id: 'session-user' } } }) },
        }),
      },
      '@/lib/supabase/service': {
        createServiceClient: () => {
          assert.fail('Must not access orders');
        },
      },
    });
    assert.deepEqual(await actions.placeOrder(request), { error: 'Checkout não habilitado.' });
    assert.deepEqual(messages, [
      ['[checkout.configuration]', { code: 'CHECKOUT_DISABLED', fields: ['COMMERCE_ENABLED'] }],
    ]);
    assert.ok(!JSON.stringify(messages).includes(request.taxDocument));
  } finally {
    console.warn = priorWarn;
  }
});

test('order creation uses session ownership and does not persist tax documents', async () => {
  let payload;
  let actor;
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({ data: null }),
    single: async () => ({
      data: {
        id: 'order',
        number: 'STUW',
        total_cents: 48400,
        payment_status: 'initializing',
        payment_fingerprint: 'hash',
      },
    }),
  };
  const actions = load('src/app/actions/order.ts', {
    ...integrationDeps,
    '@/lib/supabase/service': {
      createServiceClient: () => ({
        rpc: async (_name, args) => {
          payload = args.request;
          actor = args.input_user;
          return { data: 'order' };
        },
        from: (table) =>
          table === 'checkout_shipping_quotes'
            ? {
                ...query,
                maybeSingle: async () => ({
                  data: { context_hash: 'hash', expires_at: '2099-01-01T00:00:00Z' },
                }),
              }
            : query,
      }),
    },
    'next/cache': { revalidatePath() {} },
    '@/services/orders': orders,
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'session-user' } } }) },
        rpc: async (_name, args) => {
          payload = args.request;
          return { data: 'order' };
        },
        from: () => query,
      }),
    },
  });
  assert.equal((await actions.placeOrder(request)).order.total, 484);
  assert.equal(payload.taxDocument, undefined);
  assert.equal(payload.user_id, undefined);
  assert.equal(payload.expectedTotal, 48400);
  assert.equal(actor, 'session-user');
});
test('failed reconciliation never rejects an ambiguous payment or releases inventory', async () => {
  const failure = new integrationDeps['@/lib/integrations/http'].IntegrationError();
  failure.status = 400;
  const calls = [];
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({ data: { id: 'order' } }),
    single: async () => ({
      data: {
        id: 'order',
        number: 'STUW',
        total_cents: 48400,
        payment_status: 'initializing',
        payment_fingerprint: 'previous-token',
      },
    }),
  };
  const actions = load('src/app/actions/order.ts', {
    ...integrationDeps,
    'next/cache': { revalidatePath() {} },
    '@/services/orders': orders,
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'session-user' } } }) },
      }),
    },
    '@/lib/supabase/service': {
      createServiceClient: () => ({
        from: () => query,
        rpc: async (name) => {
          calls.push(name);
          return { data: 'order' };
        },
      }),
    },
    '@/lib/integrations/checkout': {
      ...integrationDeps['@/lib/integrations/checkout'],
      syncOrderPayment: async () => {
        throw failure;
      },
    },
  });
  const result = await actions.placeOrder(request);
  assert.equal(result.order.paymentStatus, 'initializing');
  assert.deepEqual(calls, ['create_checkout_order']);
});

test('administrative mutation cannot bypass authorization', async () => {
  const actions = load('src/app/admin/pedidos/actions.ts', {
    'next/cache': { revalidatePath() {} },
    '@/services/orders': orders,
    '@/lib/supabase/admin': {
      requireAdmin: async () => {
        throw new Error('Denied');
      },
    },
  });
  assert.ok((await actions.updateOrder({}, new FormData())).error);
});

test('request rejection keeps its diagnostic in the result screen; ambiguous errors retain the order', async () => {
  const messages = [];
  const originalWarn = console.warn;
  console.warn = (...args) => messages.push(args);
  try {
    for (const production of [false, true]) {
      for (const status of [400, 401, 403, 422, 500, 'timeout', 'network']) {
        const failure =
          status === 'timeout'
            ? new DOMException('Simulated timeout', 'TimeoutError')
            : status === 'network'
              ? new TypeError('Simulated lost connection')
              : new integrationDeps['@/lib/integrations/http'].IntegrationError();
        failure.status = status;
        failure.codes = ['unauthorized', '7'];
        const writes = [];
        const query = {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: { id: 'order' } }),
          single: async () => ({
            data: {
              id: 'order',
              number: 'STUW',
              total_cents: 48400,
              payment_status: 'initializing',
              payment_fingerprint: 'hash',
            },
          }),
        };
        const actions = load('src/app/actions/order.ts', {
          ...integrationDeps,
          'next/cache': { revalidatePath() {} },
          '@/services/orders': orders,
          '@/lib/integrations/config': {
            ...integrationDeps['@/lib/integrations/config'],
            commerceConfig: () => ({ production }),
          },
          '@/lib/supabase/server': {
            createClient: async () => ({
              auth: { getUser: async () => ({ data: { user: { id: 'session-user' } } }) },
            }),
          },
          '@/lib/supabase/service': {
            createServiceClient: () => ({
              from: () => query,
              rpc: async (name, args) => {
                writes.push({ name, args });
                return { data: 'order' };
              },
            }),
          },
          '@/lib/integrations/mercado-pago': {
            createPayment: async () => {
              throw failure;
            },
          },
        });
        const result = await actions.placeOrder(request);
        if ([500, 'timeout', 'network'].includes(status)) {
          assert.equal(result.order.paymentStatus, 'initializing');
          assert.equal(result.order.paymentIssue, undefined);
          assert.equal(writes.length, 1);
        } else {
          assert.equal(result.order.paymentStatus, 'rejected');
          assert.equal(result.order.paymentIssue.kind, 'request_rejected');
          assert.equal(result.order.paymentIssue.message.includes('Diagnóstico'), !production);
          assert.equal(result.error, undefined);
          assert.equal(writes[1].args.provider_id, 'request-rejected:order');
        }
      }
    }
    assert.equal(messages.length, 10);
    assert.ok(
      messages.every(([tag, d]) => tag === '[checkout.payment]' && d.operation === 'create'),
    );
    assert.ok(!JSON.stringify(messages).includes(request.taxDocument));
  } finally {
    console.warn = originalWarn;
  }
});
