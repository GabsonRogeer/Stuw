const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const service = loadTypeScript('src/services/olist-invoices.ts');
const order = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  number: 'STUW-ABC123',
  is_demo: false,
  payment_test_mode: false,
  payment_status: 'approved',
  subtotal_cents: 100,
  shipping_cents: 0,
  gift_cents: 0,
  discount_cents: 0,
  pix_discount_cents: 5,
  total_cents: 95,
  items: [{ sku: 'STUW-CONTROL-P', qty: 1, price_cents: 100 }],
};
const tax = '52998224725';
const invoice = {
  id: 99,
  id_venda: 78,
  valor_nota: '0.95',
  cliente: { cpf_cnpj: tax },
  situacao: 1,
  itens: [{ item: { codigo: 'STUW-CONTROL-P', quantidade: '1', ncm: '61062000', cfop: '5102' } }],
};

test('invoice guards reject demo, unpaid, divergent fiscal values, customer and SKUs', () => {
  service.assertRemoteInvoice(order, invoice, '78', '99', tax);
  for (const patch of [
    { is_demo: true },
    { payment_test_mode: true },
    { payment_status: 'pending' },
    { total_cents: 100 },
  ])
    assert.throws(() => service.assertInvoiceOrder({ ...order, ...patch }));
  for (const patch of [
    { valor_nota: '1.00' },
    { id_venda: 79 },
    { cliente: { cpf_cnpj: 'other' } },
    { itens: [] },
  ])
    assert.throws(() =>
      service.assertRemoteInvoice(order, { ...invoice, ...patch }, '78', '99', tax),
    );
  assert.equal(service.invoiceState({ situacao: 6 }), 'processing');
  assert.equal(service.invoiceState({ situacao: 6, chave_acesso: '1'.repeat(44) }), 'authorized');
  assert.equal(service.invoiceState({ situacao: 5 }), 'blocked');
});

test('fiscal kit components must match the immutable checkout reservation exactly', () => {
  const componentInvoice = {
    ...invoice,
    itens: [{ item: { ...invoice.itens[0].item, codigo: 'TOP-P' } }],
  };
  assert.throws(
    () => service.assertRemoteInvoice(order, componentInvoice, '78', '99', tax),
    /divergentes/,
  );
  service.assertRemoteInvoice(order, componentInvoice, '78', '99', tax, [
    { sku: 'TOP-P', quantity: 1 },
  ]);
  for (const reservation of [
    [{ sku: 'TOP-M', quantity: 1 }],
    [{ sku: 'TOP-P', quantity: 2 }],
    [
      { sku: 'TOP-P', quantity: 1 },
      { sku: 'SHORT-P', quantity: 1 },
    ],
    [
      { sku: 'TOP-P', quantity: 1 },
      { sku: 'TOP-P', quantity: 1 },
    ],
  ])
    assert.throws(() =>
      service.assertRemoteInvoice(order, componentInvoice, '78', '99', tax, reservation),
    );
  for (const patch of [
    { ncm: '' },
    { ncm: '00000000' },
    { ncm: '6106x2000' },
    { cfop: '' },
    { cfop: '0000' },
  ]) {
    assert.throws(() =>
      service.assertRemoteInvoice(
        order,
        { ...invoice, itens: [{ item: { ...invoice.itens[0].item, ...patch } }] },
        '78',
        '99',
        tax,
      ),
    );
  }
});

function fakeDb() {
  const rows = {
    orders: { ...order },
    olist_orders: { order_id: order.id, remote_id: '78', state: 'linked', tax_document: tax },
  };
  return {
    rows,
    async rpc() {
      return { data: [{ sku: 'STUW-CONTROL-P', quantity: 1 }], error: null };
    },
    from(table) {
      let patch;
      let upsert;
      const filters = [];
      const result = () => {
        if (table === 'order_refunds') return { data: null, count: 0, error: null };
        if (upsert && !rows[table])
          rows[table] = {
            ...upsert,
            generate_attempted_at: null,
            emit_attempted_at: null,
            invoice_id: null,
          };
        const row = rows[table];
        if (!row || filters.some(([key, value]) => row[key] !== value))
          return { data: null, error: null };
        if (patch) Object.assign(row, patch);
        return { data: { ...row }, error: null };
      };
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          filters.push([key, value]);
          return query;
        },
        is(key, value) {
          filters.push([key, value]);
          return query;
        },
        update(value) {
          patch = value;
          return query;
        },
        upsert(value) {
          upsert = value;
          return query;
        },
        single: async () => result(),
        maybeSingle: async () => result(),
        then(resolve) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      return query;
    },
  };
}
test('fiscal workflow never repeats generation/emission after a lost response and can reconcile by reading', async (t) => {
  const savedEnv = { ...process.env };
  t.after(() => {
    for (const field of ['OLIST_ENABLED', 'OLIST_INVOICE_ENABLED', 'MERCADO_PAGO_ENVIRONMENT']) {
      if (savedEnv[field] === undefined) delete process.env[field];
      else process.env[field] = savedEnv[field];
    }
  });
  process.env.OLIST_ENABLED = 'true';
  process.env.OLIST_INVOICE_ENABLED = 'true';
  process.env.MERCADO_PAGO_ENVIRONMENT = 'production';
  const db = fakeDb();
  let generated = 0;
  let emitted = 0;
  let returnedId = '';
  let authorized = false;
  const remote = {
    id: 78,
    numero_ecommerce: order.number,
    total_pedido: '0.95',
    cliente: { cpf_cnpj: tax },
  };
  const request = async (endpoint) => {
    if (endpoint === 'pedido.obter.php')
      return { pedido: { ...remote, id_nota_fiscal: returnedId } };
    if (endpoint === 'gerar.nota.fiscal.pedido.php') {
      generated++;
      returnedId = '99';
      throw new Error('Timeout');
    }
    if (endpoint === 'nota.fiscal.obter.php')
      return {
        nota_fiscal: {
          ...invoice,
          situacao: authorized ? 6 : 1,
          chave_acesso: authorized ? '1'.repeat(44) : '',
        },
      };
    if (endpoint === 'nota.fiscal.emitir.php') {
      emitted++;
      throw new Error('Timeout');
    }
    throw new Error(endpoint);
  };
  const { processOlistInvoice } = loadTypeScript('src/lib/integrations/olist-invoices.ts', {
    'server-only': {},
    '@/lib/supabase/service': { createServiceClient: () => db },
    './olist': { olistRequest: request, OlistError: class extends Error {} },
  });
  await assert.rejects(processOlistInvoice(order.id, 'admin', 'generate'), /Timeout/);
  returnedId = '';
  await assert.rejects(processOlistInvoice(order.id, 'admin', 'generate'), /Geração anterior/);
  assert.equal(generated, 1);
  returnedId = '99';
  assert.equal((await processOlistInvoice(order.id, 'admin', 'refresh')).status, 'generated');
  await assert.rejects(processOlistInvoice(order.id, 'admin', 'emit'), /Timeout/);
  await assert.rejects(processOlistInvoice(order.id, 'admin', 'emit'), /Emissão já solicitada/);
  assert.equal(emitted, 1);
  authorized = true;
  assert.equal((await processOlistInvoice(order.id, 'admin', 'refresh')).status, 'authorized');
  assert.equal((await processOlistInvoice(order.id, 'admin', 'emit')).status, 'authorized');
  assert.equal(emitted, 1);
  process.env.OLIST_INVOICE_ENABLED = 'false';
  await assert.rejects(processOlistInvoice(order.id, 'admin', 'generate'), /não está habilitado/);
});

test('invoice ledger protects attempts and identity and denies customers access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create schema auth; create table auth.users(id uuid primary key);
      create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true)='yes' $$;
      create table public.olist_orders(order_id uuid primary key);
      insert into auth.users values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
      insert into public.olist_orders values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');`);
    await db.exec(
      fs.readFileSync('supabase/migrations/20261015234201_olist_invoice_workflow.sql', 'utf8'),
    );
    await db.exec(`set role service_role;
      insert into public.olist_invoice_jobs(order_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      update public.olist_invoice_jobs set generate_attempted_at=now(),generate_actor='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',invoice_id='99';`);
    await assert.rejects(
      db.exec('update public.olist_invoice_jobs set generate_attempted_at=null'),
      /immutable/,
    );
    await assert.rejects(
      db.exec("update public.olist_invoice_jobs set invoice_id='100'"),
      /immutable/,
    );
    await db.exec('reset role; set role authenticated');
    assert.equal((await db.query('select * from public.olist_invoice_jobs')).rows.length, 0);
    await assert.rejects(
      db.exec("update public.olist_invoice_jobs set status='authorized'"),
      /permission denied/,
    );
    await db.query("select set_config('test.admin','yes',false)");
    assert.equal((await db.query('select * from public.olist_invoice_jobs')).rows.length, 1);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.exec('select * from public.olist_invoice_jobs'), /permission denied/);
  } finally {
    await db.close();
  }
});

test('generation with an omitted response ID recovers the same linked invoice without generating twice', async (t) => {
  const fields = ['OLIST_ENABLED', 'OLIST_INVOICE_ENABLED', 'MERCADO_PAGO_ENVIRONMENT'];
  const previous = fields.map((key) => process.env[key]);
  t.after(() =>
    fields.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    }),
  );
  Object.assign(process.env, {
    OLIST_ENABLED: 'true',
    OLIST_INVOICE_ENABLED: 'true',
    MERCADO_PAGO_ENVIRONMENT: 'production',
  });
  const db = fakeDb();
  let generated = 0;
  const { processOlistInvoice } = loadTypeScript('src/lib/integrations/olist-invoices.ts', {
    'server-only': {},
    '@/lib/supabase/service': { createServiceClient: () => db },
    './olist': {
      OlistError: class extends Error {},
      async olistRequest(endpoint) {
        if (endpoint === 'pedido.obter.php')
          return {
            pedido: {
              id: '78',
              numero_ecommerce: order.number,
              total_pedido: '0.95',
              cliente: { cpf_cnpj: tax },
              id_nota_fiscal: generated ? '99' : '0',
            },
          };
        if (endpoint === 'gerar.nota.fiscal.pedido.php') {
          generated++;
          return { status: 'OK' };
        }
        if (endpoint === 'nota.fiscal.obter.php') return { nota_fiscal: invoice };
        throw new Error('Unexpected endpoint');
      },
    },
  });
  assert.deepEqual(await processOlistInvoice(order.id, 'admin', 'generate'), {
    status: 'generated',
    invoiceId: '99',
  });
  assert.equal((await processOlistInvoice(order.id, 'admin', 'generate')).invoiceId, '99');
  assert.equal(generated, 1);
});

test('component snapshot RPC only exposes the selected order to the service role', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; grant usage on schema private to service_role;
      create table private.olist_inventory_holds(order_id uuid,sku text,quantity integer);
      alter table private.olist_inventory_holds enable row level security;
      grant select on private.olist_inventory_holds to service_role;
      insert into private.olist_inventory_holds values
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','TOP-P',1),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','OTHER',9);`);
    await db.exec(
      fs.readFileSync(
        'supabase/migrations/20261016031440_olist_invoice_component_validation.sql',
        'utf8',
      ),
    );
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await assert.rejects(
        db.query(
          "select * from public.get_olist_invoice_components('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')",
        ),
        /permission denied/,
      );
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.deepEqual(
      (
        await db.query(
          "select * from public.get_olist_invoice_components('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')",
        )
      ).rows,
      [{ sku: 'TOP-P', quantity: 1 }],
    );
  } finally {
    await db.close();
  }
});
