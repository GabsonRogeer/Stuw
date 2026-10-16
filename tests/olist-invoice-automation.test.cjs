const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

test('automatic queue excludes old/manual/demo/unpaid orders, recovers leases and protects access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema private; create schema vault; create schema net; create schema cron;
      create table auth.users(id uuid primary key);
      create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true)='yes' $$;
      create table public.orders(id uuid primary key,created_at timestamptz default now(),payment_status text default 'approved',is_demo boolean default false,payment_test_mode boolean default false,total_cents integer default 100);
      create table public.olist_orders(order_id uuid primary key,remote_id text default '78',state text default 'linked');
      grant select on public.orders,public.olist_orders to service_role;
      create table private.commerce_job_runs(request_id bigint primary key,kind text check(kind in ('payments','emails','orders')),started_at timestamptz default now());
      create table vault.decrypted_secrets(name text,decrypted_secret text);
      insert into vault.decrypted_secrets values ('stuw_olist_cron_secret',repeat('x',32));
      create table net.requests(id bigint generated always as identity,url text,headers jsonb,timeout integer);
      create function net.http_get(url text,headers jsonb,timeout_milliseconds integer) returns bigint language sql as $$ insert into net.requests(url,headers,timeout) values(url,headers,timeout_milliseconds) returning id $$;
      create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text,active boolean default true);
      create function cron.schedule(name text,schedule text,command text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values(name,schedule,command) returning jobid $$;
      create function cron.alter_job(job bigint,active boolean) returns void language sql as $$ update cron.job set active=$2 where jobid=$1 $$;
      insert into public.orders(id,created_at) values('${id}',now()),('${other}',now()-interval '1 day');
      insert into public.orders(id,payment_status) values('cccccccc-cccc-cccc-cccc-cccccccccccc','pending');
      insert into public.orders(id,is_demo) values('dddddddd-dddd-dddd-dddd-dddddddddddd',true);
      insert into public.orders(id,payment_test_mode) values('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',true);
      insert into public.orders(id) values('ffffffff-ffff-ffff-ffff-ffffffffffff');
      insert into public.olist_orders(order_id) select id from public.orders;`);
    await db.exec(
      fs.readFileSync('supabase/migrations/20261015234201_olist_invoice_workflow.sql', 'utf8'),
    );
    await db.exec(
      "insert into public.olist_invoice_jobs(order_id,status,invoice_id) values('ffffffff-ffff-ffff-ffff-ffffffffffff','authorized','99')",
    );
    await db.exec(
      fs.readFileSync('supabase/migrations/20261016135108_automatic_olist_invoicing.sql', 'utf8'),
    );
    const claim = (worker = id) =>
      db.query('select * from public.claim_automatic_olist_invoice($1)', [worker]);
    assert.equal(
      (await db.query("select active from cron.job where jobname='stuw-olist-invoices'")).rows[0]
        .active,
      false,
    );
    await db.exec("select private.run_commerce_job('invoices')");
    assert.equal(
      (await db.query('select url from net.requests')).rows[0].url,
      'https://stuw.vercel.app/api/jobs/olist?direction=invoices',
    );
    await db.exec('set role service_role');
    assert.equal((await claim()).rows.length, 0);
    await db.exec(
      "update public.olist_invoice_automation set enabled=true,activated_at=now()-interval '1 minute'",
    );
    const first = (await claim()).rows;
    assert.equal(first.length, 1);
    assert.equal(first[0].order_id, id);
    assert.equal(first[0].automatic, true);
    assert.equal(first[0].automation_attempts, 1);
    assert.equal((await claim(other)).rows.length, 0, 'active lease cannot be claimed twice');
    assert.equal((await db.query('select * from public.olist_invoice_jobs')).rows.length, 2);
    await db.exec(
      "update public.olist_invoice_jobs set lease_until=now()-interval '1 second' where automatic",
    );
    assert.equal((await claim(other)).rows[0].automation_attempts, 2);
    await db.exec(
      "update public.olist_invoice_jobs set generate_attempted_at=now(),status='blocked',lease_owner=null,lease_until=null where automatic",
    );
    assert.equal((await claim()).rows.length, 0);
    await assert.rejects(
      db.exec('update public.olist_invoice_jobs set generate_attempted_at=null where automatic'),
      /immutable/,
    );
    await db.exec('reset role; set role authenticated');
    assert.equal((await db.query('select * from public.olist_invoice_automation')).rows.length, 0);
    assert.equal((await db.query('select * from public.olist_invoice_jobs')).rows.length, 0);
    await assert.rejects(claim(), /permission denied/);
    await assert.rejects(
      db.exec('update public.olist_invoice_automation set enabled=true'),
      /permission denied/,
    );
    await db.exec("select set_config('test.admin','yes',false)");
    assert.equal((await db.query('select * from public.olist_invoice_automation')).rows.length, 1);
    await db.exec('reset role; set role anon');
    await assert.rejects(claim(), /permission denied/);
    await assert.rejects(
      db.query('select * from public.olist_invoice_automation'),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

class OlistError extends Error {
  constructor(code) {
    super(`Olist: ${code}`);
    this.code = code;
  }
}

function harness(t, options = {}) {
  const keys = [
    'OLIST_ENABLED',
    'OLIST_INVOICE_ENABLED',
    'OLIST_API_TOKEN',
    'MERCADO_PAGO_ENVIRONMENT',
  ];
  const previous = keys.map((key) => process.env[key]);
  t.after(() =>
    keys.forEach((key, i) =>
      previous[i] === undefined ? delete process.env[key] : (process.env[key] = previous[i]),
    ),
  );
  Object.assign(process.env, {
    OLIST_ENABLED: 'true',
    OLIST_INVOICE_ENABLED: 'true',
    OLIST_API_TOKEN: 'fake',
    MERCADO_PAGO_ENVIRONMENT: 'production',
  });
  const task = {
    order_id: id,
    invoice_id: null,
    status: 'pending',
    generate_attempted_at: null,
    emit_attempted_at: null,
    validated_skus: [],
    automation_attempts: 0,
    lease_owner: null,
    lease_until: null,
    ...options.task,
  };
  const order = {
    id,
    is_demo: false,
    payment_test_mode: false,
    payment_status: 'approved',
    total_cents: 100,
    subtotal_cents: 100,
    shipping_cents: 0,
    gift_cents: 0,
    discount_cents: 0,
    pix_discount_cents: 0,
    items: [{ sku: 'TOP-P', qty: 1, price_cents: 100 }],
    ...options.order,
  };
  const components = options.components ?? [{ sku: 'TOP-P', quantity: 1 }];
  const links = components.map((c, i) => ({
    sku: c.sku,
    remote_id: String(i + 1),
    state: 'linked',
  }));
  const calls = [];
  let claimed = 0;
  const db = {
    async rpc(name, args) {
      if (name === 'get_olist_invoice_components') return { data: components, error: null };
      claimed++;
      task.lease_owner = args.worker;
      task.automation_attempts++;
      return { data: [structuredClone(task)], error: null };
    },
    from(table) {
      const filters = [];
      let patch;
      const data = () =>
        table === 'orders'
          ? order
          : table === 'olist_invoice_jobs'
            ? task
            : table === 'olist_skus'
              ? links
              : { id: true, enabled: false, activated_at: null };
      const result = () => {
        if (table === 'order_refunds')
          return { data: null, count: options.refunds ?? 0, error: null };
        const row = data();
        if (!Array.isArray(row) && filters.some(([k, v]) => row[k] !== v))
          return { data: null, error: null };
        if (patch) Object.assign(row, patch);
        return { data: structuredClone(row), error: null };
      };
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters.push([k, v]);
          return q;
        },
        in() {
          return q;
        },
        update(value) {
          patch = value;
          return q;
        },
        single: async () => result(),
        maybeSingle: async () => result(),
        then(resolve) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      return q;
    },
  };
  const api = loadTypeScript('src/lib/integrations/olist-invoice-automation.ts', {
    'server-only': {},
    '@/lib/supabase/service': { createServiceClient: () => db },
    './olist': {
      OlistError,
      async getOlistProduct(remoteId) {
        calls.push(['product', remoteId]);
        return (
          options.product ?? {
            codigo: links.find((l) => l.remote_id === remoteId).sku,
            ncm: '6106.20.00',
            origem: '0',
            unidade: 'UN',
          }
        );
      },
    },
    './olist-invoices': {
      async processOlistInvoice(orderId, actor, operation) {
        calls.push([operation, actor]);
        if (options.failure) throw options.failure;
        if (operation === 'generate')
          Object.assign(task, {
            invoice_id: '99',
            generate_attempted_at: new Date().toISOString(),
          });
        if (operation === 'emit') task.emit_attempted_at = new Date().toISOString();
        return {
          status: options.result ?? (operation === 'emit' ? 'authorized' : 'generated'),
          invoiceId: '99',
        };
      },
    },
  });
  return {
    ...api,
    task,
    calls,
    get claimed() {
      return claimed;
    },
  };
}

test('automatic worker validates fiscal sources, generates, then authorizes as system actor', async (t) => {
  const h = harness(t);
  assert.equal(await h.syncAutomaticOlistInvoice(), 'validated');
  assert.equal(await h.syncAutomaticOlistInvoice(), 'generated');
  assert.equal(await h.syncAutomaticOlistInvoice(), 'authorized');
  assert.deepEqual(h.calls, [
    ['product', '1'],
    ['generate', null],
    ['emit', null],
  ]);
  assert.equal(h.task.lease_owner, null);
});

test('preflight resumes large carts and blocks missing NCM before any fiscal write', async (t) => {
  const components = Array.from({ length: 5 }, (_, i) => ({ sku: `TOP-${i}`, quantity: 1 }));
  const h = harness(t, { components });
  await h.syncAutomaticOlistInvoice();
  assert.equal(h.calls.length, 3);
  await h.syncAutomaticOlistInvoice();
  assert.equal(h.calls.length, 5);
  assert.equal(h.task.validated_skus.length, 5);
  const invalid = harness(t, { product: { codigo: 'TOP-P', ncm: '', origem: '0', unidade: 'UN' } });
  assert.equal(await invalid.syncAutomaticOlistInvoice(), 'blocked');
  assert.match(invalid.task.last_error, /NCM/);
  assert.deepEqual(invalid.calls, [['product', '1']]);
});

test('uncertain generation and emission can only read, including when a draft remains', async (t) => {
  for (const task of [
    { generate_attempted_at: '2026-10-16T00:00:00Z' },
    {
      invoice_id: '99',
      generate_attempted_at: '2026-10-16T00:00:00Z',
      emit_attempted_at: '2026-10-16T00:01:00Z',
    },
  ]) {
    const h = harness(t, { task, result: 'generated' });
    await h.syncAutomaticOlistInvoice();
    assert.deepEqual(h.calls, [['refresh', null]]);
  }
  const h = harness(t, {
    task: { validated_skus: ['TOP-P'] },
    failure: new OlistError('CONNECTION'),
  });
  assert.equal(await h.syncAutomaticOlistInvoice(), 'retry');
  assert.equal(h.task.lease_owner, null);
});

test('refunded or unpaid orders stop without contacting Olist; verification is read only', async (t) => {
  for (const options of [{ refunds: 1 }, { order: { payment_status: 'cancelled' } }]) {
    const h = harness(t, options);
    assert.equal(await h.syncAutomaticOlistInvoice(), 'blocked');
    assert.equal(h.calls.length, 0);
  }
  const h = harness(t);
  assert.deepEqual(await h.getInvoiceAutomationStatus(), {
    ready: true,
    automaticEnabled: false,
    activatedAt: null,
  });
  assert.equal(h.claimed, 0);
  process.env.OLIST_INVOICE_ENABLED = 'false';
  assert.equal(await h.syncAutomaticOlistInvoice(), 'disabled');
  assert.equal(h.claimed, 0);
});

test('fiscal endpoint protects verification and processing with the cron secret', async (t) => {
  const previous = process.env.CRON_SECRET;
  t.after(() =>
    previous === undefined ? delete process.env.CRON_SECRET : (process.env.CRON_SECRET = previous),
  );
  process.env.CRON_SECRET = 'test-cron-secret';
  let claimed = 0;
  let verified = 0;
  const { GET } = loadTypeScript('src/app/api/jobs/olist/route.ts', {
    '@/lib/integrations/olist-sync': {
      async syncOlistCatalog() {
        claimed++;
        return { result: 'idle' };
      },
    },
    '@/lib/integrations/olist-invoice-automation': {
      async getInvoiceAutomationStatus() {
        verified++;
        return { ready: true, automaticEnabled: false };
      },
    },
  });
  const url = 'https://example.com/api/jobs/olist?direction=invoices&verify=1';
  assert.equal((await GET(new Request(url))).status, 401);
  assert.equal(verified, 0);
  const response = await GET(
    new Request(url, { headers: { authorization: 'Bearer test-cron-secret' } }),
  );
  assert.equal(response.status, 200);
  assert.equal(verified, 1);
  assert.equal(claimed, 0);
});

test('admin resumption never resets fiscal attempts or permits an unauthorized caller', async () => {
  let authorized = false;
  let patch;
  let providerCalls = 0;
  const filters = [];
  const q = {
    update(value) {
      patch = value;
      return q;
    },
    eq(k, v) {
      filters.push([k, v]);
      return q;
    },
    is(k, v) {
      filters.push([k, v]);
      return q;
    },
    select() {
      return q;
    },
    async maybeSingle() {
      return { data: { order_id: id }, error: null };
    },
  };
  const { changeInvoice } = loadTypeScript('src/app/admin/olist/actions.ts', {
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase/admin': {
      async requireAdmin() {
        if (!authorized) throw new Error('Unauthorized');
        return { user: { id: other } };
      },
    },
    '@/lib/supabase/service': {
      createServiceClient() {
        return {
          from() {
            return q;
          },
        };
      },
    },
    '@/lib/integrations/olist-invoices': {
      async processOlistInvoice() {
        providerCalls++;
      },
    },
  });
  const form = new FormData();
  form.set('orderId', id);
  form.set('operation', 'retry');
  form.set('reviewed', 'on');
  assert.ok((await changeInvoice(form)).error);
  assert.equal(patch, undefined);
  authorized = true;
  assert.ok((await changeInvoice(form)).message);
  assert.equal(providerCalls, 0);
  assert.ok(filters.some(([k, v]) => k === 'status' && v === 'blocked'));
  assert.ok(filters.some(([k, v]) => k === 'lease_owner' && v === null));
  for (const key of [
    'generate_attempted_at',
    'emit_attempted_at',
    'invoice_id',
    'generate_actor',
    'emit_actor',
  ])
    assert.equal(Object.hasOwn(patch, key), false);
});
