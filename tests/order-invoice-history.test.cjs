const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript: load } = require('../scripts/lib/load-typescript.cjs');
const history = load('src/services/order-history.ts');
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const viewer = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const order = {
  id,
  user_id: viewer,
  number: 'STW-TEST',
  is_demo: false,
  payment_test_mode: false,
  created_at: '2026-10-16T14:47:07Z',
  payment_status: 'approved',
  status: 'paid',
  items: [],
  delivery: {},
  subtotal_cents: 100,
  shipping_cents: 0,
  gift_cents: 0,
  discount_cents: 0,
  pix_discount_cents: 0,
  total_cents: 100,
};
const registered = {
  id: 'registered',
  order_id: id,
  actor_id: null,
  status: 'pending',
  note: 'Pedido recebido.',
  created_at: order.created_at,
};
const generation = {
  order_id: id,
  invoice_id: '99',
  generate_attempted_at: '2026-10-16T15:01:56Z',
};
const invoice = { order_id: id, number: '77', series: '1', authorized_at: '2026-10-16T15:02:56Z' };

test('invoice history shows confirmed generation before authorization and also covers existing invoices', () => {
  const original = [registered];
  const generated = history.orderHistoryWithInvoice(order, original, generation, null);
  assert.deepEqual(
    generated.map((e) => e.status),
    ['pending', 'invoice_generated'],
  );
  assert.equal(original.length, 1, 'display projection must not mutate stored history');
  const authorized = history.orderHistoryWithInvoice(order, original, generation, invoice);
  assert.deepEqual(
    authorized.map((e) => e.status),
    ['pending', 'invoice_generated', 'invoice_authorized'],
  );
  assert.equal(authorized[1].created_at, generation.generate_attempted_at);
  assert.equal(authorized[2].created_at, invoice.authorized_at);
  assert.match(authorized[2].note, /77.*1/);
  assert.equal(
    history.orderHistoryWithInvoice(order, original, null, invoice).at(-1).status,
    'invoice_authorized',
  );
});

test('attempts alone, unrelated invoices and test orders cannot produce fiscal history', () => {
  assert.deepEqual(
    history.orderHistoryWithInvoice(order, [], { ...generation, invoice_id: null }, null),
    [],
  );
  assert.deepEqual(
    history.orderHistoryWithInvoice(
      order,
      [],
      { ...generation, generate_attempted_at: null },
      null,
    ),
    [],
  );
  assert.deepEqual(
    history.orderHistoryWithInvoice(
      order,
      [],
      { ...generation, generate_attempted_at: 'invalid' },
      null,
    ),
    [],
  );
  assert.deepEqual(
    history.orderHistoryWithInvoice(
      order,
      [],
      { ...generation, order_id: viewer },
      { ...invoice, order_id: viewer },
    ),
    [],
  );
  for (const patch of [{ is_demo: true }, { payment_test_mode: true }])
    assert.deepEqual(
      history.orderHistoryWithInvoice({ ...order, ...patch }, [registered], generation, invoice),
      [registered],
    );
});

test('invoice history deduplicates persisted stages and orders equal timestamps consistently', () => {
  const existing = {
    id: 'existing',
    order_id: id,
    actor_id: null,
    status: 'invoice_generated',
    note: 'Gerada.',
    created_at: generation.generate_attempted_at,
  };
  const result = history.orderHistoryWithInvoice(
    order,
    [existing, registered, { ...registered, order_id: viewer }],
    generation,
    invoice,
  );
  assert.equal(result.filter((e) => e.status === 'invoice_generated').length, 1);
  assert.equal(result[0].id, registered.id);
  assert.equal(result.length, 3);
  const tied = history.orderHistoryWithInvoice(order, [], generation, {
    ...invoice,
    authorized_at: generation.generate_attempted_at,
  });
  assert.deepEqual(
    tied.map((e) => e.status),
    ['invoice_generated', 'invoice_authorized'],
  );
});

test('privileged fiscal history is read only after ownership and projects no errors, actors or private files', async () => {
  let calls = 0;
  let fail = false;
  const fields = [];
  const filters = [];
  const { loadOwnedInvoiceGeneration } = load('src/lib/invoices/customer-history.ts', {
    'server-only': {},
    '@/lib/supabase/service': {
      createServiceClient() {
        calls++;
        const q = {
          select(value) {
            fields.push(value);
            return q;
          },
          eq(key, value) {
            filters.push([key, value]);
            return q;
          },
          async maybeSingle() {
            return {
              data: fail ? null : generation,
              error: fail ? { message: 'private error' } : null,
            };
          },
        };
        return { from: () => q };
      },
    },
  });
  assert.equal((await loadOwnedInvoiceGeneration(order, '')).error, true);
  assert.equal((await loadOwnedInvoiceGeneration(order, 'someone-else')).error, true);
  assert.equal((await loadOwnedInvoiceGeneration({ ...order, is_demo: true }, viewer)).data, null);
  assert.equal(calls, 0);
  assert.deepEqual((await loadOwnedInvoiceGeneration(order, viewer)).data, generation);
  assert.deepEqual(fields, ['order_id,invoice_id,generate_attempted_at']);
  assert.deepEqual(filters, [['order_id', id]]);
  fail = true;
  assert.deepEqual(await loadOwnedInvoiceGeneration(order, viewer), { data: null, error: true });
});

function loadComponent(file, dependencies) {
  const filename = path.resolve(file);
  const compiled = new Module(filename);
  compiled.require = (name) => (name in dependencies ? dependencies[name] : require(name));
  compiled._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return compiled.exports;
}

test('customer history renders human fiscal stages with dates and a link only when documents exist', () => {
  const { OrderDetails } = loadComponent('src/components/orders/OrderDetails.tsx', {
    '@/lib/commerce': { currency: (v) => `R$ ${v}` },
    '@/services/orders': { ORDER_LABELS: { paid: 'Pago' } },
    '@/services/fulfillment': {
      PAYMENT_LABELS: { approved: 'Pagamento aprovado' },
      SHIPMENT_LABELS: {},
    },
    '@/services/order-history': history,
    './ShipmentTimeline': { ShipmentTimeline: () => null },
  });
  const events = history.orderHistoryWithInvoice(order, [registered], generation, invoice);
  const html = renderToStaticMarkup(
    React.createElement(OrderDetails, { order, events, invoiceAvailable: true }),
  );
  assert.match(html, /Nota fiscal gerada/);
  assert.match(html, /Nota fiscal autorizada/);
  assert.match(html, /href="#invoice-title"/);
  assert.match(html, /dateTime="2026-10-16T15:02:56Z"/);
  assert.doesNotMatch(html, /invoice_generated|invoice_authorized/);
  const withoutDocuments = renderToStaticMarkup(
    React.createElement(OrderDetails, { order, events }),
  );
  assert.doesNotMatch(withoutDocuments, /href="#invoice-title"/);
});

test('customer page refuses a different owner before loading privileged fiscal history', async () => {
  let owner = false;
  let fiscalCalls = 0;
  const filters = [];
  const supabase = {
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq(key, value) {
          filters.push([table, key, value]);
          return q;
        },
        order: async () => ({ data: [registered], error: null }),
        async maybeSingle() {
          return { data: table === 'orders' ? (owner ? order : null) : invoice, error: null };
        },
      };
      return q;
    },
  };
  const { default: OrderPage } = loadComponent('src/app/conta/compras/[id]/page.tsx', {
    'next/link': { default: () => null },
    'next/navigation': {
      notFound() {
        throw new Error('NOT_FOUND');
      },
    },
    '@/lib/supabase/account': { requireAccount: async () => ({ supabase, user: { id: viewer } }) },
    '@/services/orders': { isUuid: () => true },
    '@/components/orders/OrderDetails': { OrderDetails: () => null },
    '@/components/checkout/PaymentStatus': { PaymentStatus: () => null },
    '@/lib/invoices/customer-history': {
      loadOwnedInvoiceGeneration: async () => {
        fiscalCalls++;
        return { data: generation, error: false };
      },
    },
    '@/services/order-history': history,
  });
  await assert.rejects(OrderPage({ params: Promise.resolve({ id }) }), /NOT_FOUND/);
  assert.equal(fiscalCalls, 0);
  assert.ok(
    filters.some(
      ([table, key, value]) => table === 'orders' && key === 'user_id' && value === viewer,
    ),
  );
  owner = true;
  const tree = await OrderPage({ params: Promise.resolve({ id }) });
  const details = tree.props.children.find((child) => child?.props?.events);
  assert.equal(fiscalCalls, 1);
  assert.equal(details.props.invoiceAvailable, true);
  assert.deepEqual(
    details.props.events.map((e) => e.status),
    ['pending', 'invoice_generated', 'invoice_authorized'],
  );
});
