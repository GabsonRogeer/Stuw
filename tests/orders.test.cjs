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
const request = {
  key: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  information: checkout.DEMO_INFORMATION,
  items: [{ id: 1, size: 'M', color: 'Black', qty: 1 }],
  shipping: 'standard',
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
test('order creation uses session ownership and does not persist tax documents', async () => {
  let payload;
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    single: async () => ({ data: { id: 'order', number: 'TEST', total_cents: 48400 } }),
  };
  const actions = load('src/app/actions/order.ts', {
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
