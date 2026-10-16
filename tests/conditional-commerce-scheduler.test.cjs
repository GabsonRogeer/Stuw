const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');

const migration = fs.readFileSync(
  'supabase/migrations/20261016155539_conditional_commerce_scheduler.sql',
  'utf8',
);

test('conditional scheduler gates HTTP by real queues and preserves recovery, access and schedules', async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create schema vault; create schema net; create schema cron;
      create table public.orders(id text primary key,created_at timestamptz default now(),payment_status text default 'approved',is_demo boolean default false,payment_test_mode boolean default false,total_cents int default 100);
      create table public.order_integrations(order_id text primary key,next_sync_at timestamptz);
      create table public.email_outbox(status text,available_at timestamptz default now(),claimed_at timestamptz);
      create table public.olist_invoice_automation(id boolean default true,enabled boolean default false,activated_at timestamptz);
      insert into public.olist_invoice_automation default values;
      create table public.olist_invoice_jobs(order_id text primary key,status text default 'pending',automatic boolean default true,next_attempt_at timestamptz default now(),lease_until timestamptz,documents_next_attempt_at timestamptz default now());
      create table public.order_invoice_documents(order_id text primary key);
      create table public.olist_orders(order_id text primary key,state text default 'linked',updated_at timestamptz default now(),remote_id text default '99');
      create table public.olist_inventory(sku text primary key,next_check_at timestamptz default now());
      create table public.olist_skus(sku text primary key,state text default 'linked',remote_id text default '99',product_id int default 1);
      create table public.admin_products(id int primary key,deleted_at timestamptz);
      create table private.product_kit_components(kit_sku text);
      create table public.olist_cursor(id boolean default true,locked_until timestamptz default '-infinity');
      insert into public.olist_cursor default values;
      create table private.commerce_job_runs(request_id bigint primary key,kind text,started_at timestamptz default now());
      create table private.olist_stock_job_runs(request_id bigint primary key,started_at timestamptz default now());
      create table vault.decrypted_secrets(name text,decrypted_secret text);
      insert into vault.decrypted_secrets values('stuw_olist_cron_secret',repeat('x',32));
      create table net.requests(id bigint generated always as identity,url text,headers jsonb,timeout integer);
      create function net.http_get(url text,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$ insert into net.requests(url,headers,timeout) values(url,headers,timeout_milliseconds) returning id $$;
      create table cron.job(jobname text,schedule text,active boolean);
      insert into cron.job values('orders','30 seconds',true),('stock','* * * * *',true);
    `);
    await db.exec(migration);
    const due = async (kind) =>
      (await db.query('select private.commerce_job_has_work($1) as due', [kind])).rows[0].due;
    const run = async (kind) =>
      (
        await db.query(
          kind === 'stock'
            ? 'select private.run_olist_stock_job() as id'
            : 'select private.run_commerce_job($1) as id',
          kind === 'stock' ? [] : [kind],
        )
      ).rows[0].id;
    async function scenario(name, fn) {
      await t.test(name, async () => {
        await db.exec('begin');
        try {
          await fn();
        } finally {
          await db.exec('rollback');
        }
      });
    }

    await scenario(
      'idle queues do not read secrets, enqueue HTTP or create execution records',
      async () => {
        await db.exec('delete from vault.decrypted_secrets');
        for (const kind of ['payments', 'emails', 'orders', 'invoices', 'stock']) {
          assert.equal(await due(kind), false);
          assert.equal(await run(kind), null);
        }
        assert.equal((await db.query('select * from net.requests')).rows.length, 0);
        assert.equal((await db.query('select * from private.commerce_job_runs')).rows.length, 0);
        assert.equal((await db.query('select * from private.olist_stock_job_runs')).rows.length, 0);
        assert.deepEqual((await db.query('select * from cron.job order by jobname')).rows, [
          { jobname: 'orders', schedule: '30 seconds', active: true },
          { jobname: 'stock', schedule: '* * * * *', active: true },
        ]);
      },
    );

    await scenario(
      'payment checks respect due time and production but retain approved payment monitoring',
      async () => {
        await db.exec(
          "insert into public.orders(id,payment_status) values('paid','approved'); insert into public.order_integrations values('paid',now()+interval '1 hour')",
        );
        assert.equal(await due('payments'), false);
        await db.exec(
          "update public.order_integrations set next_sync_at=now()-interval '1 second'",
        );
        assert.equal(
          await due('payments'),
          true,
          'approved payments still need refund reconciliation',
        );
        assert.ok(await run('payments'));
        for (const column of ['is_demo', 'payment_test_mode']) {
          await db.exec(`update public.orders set ${column}=true`);
          assert.equal(await due('payments'), false);
          await db.exec(`update public.orders set ${column}=false`);
        }
        await db.exec('update public.order_integrations set next_sync_at=null');
        assert.equal(await due('payments'), false);
      },
    );

    await scenario(
      'email readiness includes due sends, interrupted sends and missing fiscal documents',
      async () => {
        await db.exec(
          "insert into public.email_outbox(status,available_at) values('pending',now()+interval '5 minutes')",
        );
        assert.equal(await due('emails'), false);
        await db.exec('update public.email_outbox set available_at=now()');
        assert.equal(await due('emails'), true);
        await db.exec("update public.email_outbox set status='sent'");
        assert.equal(await due('emails'), false);
        await db.exec(
          "update public.email_outbox set status='sending',claimed_at=now()-interval '9 minutes'",
        );
        assert.equal(await due('emails'), false);
        await db.exec("update public.email_outbox set claimed_at=now()-interval '11 minutes'");
        assert.equal(await due('emails'), true, 'worker must mark an interrupted send uncertain');
        await db.exec(
          "update public.email_outbox set status='uncertain'; insert into public.olist_invoice_jobs(order_id,status) values('note','authorized')",
        );
        assert.equal(
          await due('emails'),
          true,
          'authorized NF without archived documents must wake email worker',
        );
        assert.ok(await run('emails'));
        await db.exec(
          "update public.olist_invoice_jobs set documents_next_attempt_at=now()+interval '5 minutes'",
        );
        assert.equal(await due('emails'), false);
        await db.exec(
          "update public.olist_invoice_jobs set documents_next_attempt_at=now(); insert into public.order_invoice_documents values('note')",
        );
        assert.equal(
          await due('emails'),
          false,
          'completed documents and uncertain sends are not sent again',
        );
      },
    );

    await scenario(
      'orders preserve new and uncertain work while spacing linked checks',
      async () => {
        await db.exec("insert into public.olist_orders(order_id) values('existing')");
        assert.equal(await due('orders'), false);
        await db.exec("update public.olist_orders set updated_at=now()-interval '5 minutes'");
        assert.equal(await due('orders'), true);
        assert.ok(await run('orders'));
        for (const state of ['pending', 'uncertain']) {
          await db.query('update public.olist_orders set state=$1,updated_at=now()', [state]);
          assert.equal(await due('orders'), true);
        }
        for (const state of ['blocked', 'waiting_payment']) {
          await db.query('update public.olist_orders set state=$1', [state]);
          assert.equal(await due('orders'), false);
        }
      },
    );

    await scenario(
      'invoice candidate before queue creation wakes the worker with the original fiscal cutoff',
      async () => {
        await db.exec(
          "insert into public.orders(id) values('fresh'); insert into public.olist_orders(order_id) values('fresh')",
        );
        assert.equal(await due('invoices'), false);
        await db.exec(
          "update public.olist_invoice_automation set enabled=true,activated_at=now()-interval '1 hour'",
        );
        assert.equal(await due('invoices'), true);
        assert.ok(await run('invoices'));
        for (const column of ['is_demo', 'payment_test_mode']) {
          await db.exec(`update public.orders set ${column}=true`);
          assert.equal(await due('invoices'), false);
          await db.exec(`update public.orders set ${column}=false`);
        }
        await db.exec("update public.orders set created_at=now()-interval '1 day'");
        assert.equal(await due('invoices'), false);
        await db.exec("update public.orders set created_at=now(),payment_status='pending'");
        assert.equal(await due('invoices'), false);
        await db.exec(
          "update public.orders set payment_status='approved'; update public.olist_orders set state='pending'",
        );
        assert.equal(await due('invoices'), false);
      },
    );

    await scenario(
      'invoice jobs respect activation, backoff and leases without reopening terminal or manual jobs',
      async () => {
        await db.exec(
          "update public.olist_invoice_automation set enabled=true,activated_at=now()-interval '1 hour'; insert into public.orders(id) values('queued'); insert into public.olist_invoice_jobs(order_id) values('queued')",
        );
        assert.equal(await due('invoices'), true);
        await db.exec(
          "update public.olist_invoice_jobs set lease_until=now()+interval '3 minutes'",
        );
        assert.equal(await due('invoices'), false);
        await db.exec(
          "update public.olist_invoice_jobs set lease_until=now()-interval '1 second',next_attempt_at=now()+interval '2 minutes'",
        );
        assert.equal(await due('invoices'), false);
        await db.exec('update public.olist_invoice_jobs set next_attempt_at=now()');
        assert.equal(await due('invoices'), true);
        for (const status of ['authorized', 'blocked']) {
          await db.query('update public.olist_invoice_jobs set status=$1', [status]);
          assert.equal(await due('invoices'), false);
        }
        await db.exec("update public.olist_invoice_jobs set status='pending',automatic=false");
        assert.equal(await due('invoices'), false);
        await db.exec(
          'update public.olist_invoice_jobs set automatic=true; update public.olist_invoice_automation set enabled=false',
        );
        assert.equal(await due('invoices'), false);
      },
    );

    await scenario(
      'stock readiness preserves due checks, webhook priority and bootstrap of physical SKUs',
      async () => {
        await db.exec(
          "insert into public.olist_inventory values('physical',now()+interval '2 minutes')",
        );
        assert.equal(await due('stock'), false);
        await db.exec("update public.olist_inventory set next_check_at='1970-01-01'");
        assert.equal(await due('stock'), true, 'webhook-prioritized SKU wakes stock worker');
        assert.ok(await run('stock'));
        await db.exec(
          "update public.olist_inventory set next_check_at=now()+interval '2 minutes'; insert into public.admin_products(id) values(1); insert into public.olist_skus(sku) values('new')",
        );
        assert.equal(await due('stock'), true);
        await db.exec("insert into private.product_kit_components values('new')");
        assert.equal(await due('stock'), false, 'kits do not need their own physical inventory');
        await db.exec(
          'delete from private.product_kit_components; update public.admin_products set deleted_at=now()',
        );
        assert.equal(await due('stock'), false);
      },
    );

    await scenario(
      'busy ERP skips HTTP but leaves pending work untouched for the next scheduled run',
      async () => {
        await db.exec(
          "insert into public.olist_orders(order_id,state) values('new','pending'); insert into public.olist_inventory(sku) values('new'); update public.olist_invoice_automation set enabled=true,activated_at=now()-interval '1 hour'; insert into public.orders(id) values('new'); insert into public.olist_invoice_jobs(order_id) values('new'); update public.olist_cursor set locked_until=now()+interval '1 minute'",
        );
        for (const kind of ['orders', 'stock', 'invoices']) {
          assert.equal(await due(kind), true);
          assert.equal(await run(kind), null);
        }
        assert.equal((await db.query('select * from net.requests')).rows.length, 0);
        await db.exec("update public.olist_cursor set locked_until=now()-interval '1 second'");
        for (const kind of ['orders', 'stock', 'invoices']) assert.ok(await run(kind));
        const requests = (await db.query('select url,timeout from net.requests order by id')).rows;
        assert.deepEqual(
          requests.map((r) => r.timeout),
          [50000, 110000, 120000],
        );
        assert.ok(
          requests.every((r) =>
            r.url.startsWith('https://stuw.vercel.app/api/jobs/olist?direction='),
          ),
        );
      },
    );

    await scenario(
      'private scheduler functions are invoker-only and inaccessible to API roles',
      async () => {
        for (const role of ['anon', 'authenticated', 'service_role'])
          for (const signature of [
            'private.commerce_job_has_work(text)',
            'private.run_commerce_job(text)',
            'private.run_olist_stock_job()',
          ])
            assert.equal(
              (
                await db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed", [
                  role,
                  signature,
                ])
              ).rows[0].allowed,
              false,
            );
        const funcs = (
          await db.query("select prosecdef from pg_proc where pronamespace='private'::regnamespace")
        ).rows;
        assert.ok(funcs.every((f) => !f.prosecdef));
        await assert.rejects(
          db.query("select private.commerce_job_has_work('unknown')"),
          /Unknown commerce job/,
        );
      },
    );
  } finally {
    await db.close();
  }
});

test('Olist worker prioritizes new orders and only rechecks linked orders after five minutes', async () => {
  async function exercise(pending, linked) {
    const filters = [];
    const queried = [];
    const updated = [];
    let selectedId;
    const db = {
      from(table) {
        const q = {
          select() {
            return q;
          },
          in(key, values) {
            filters.push([key, values]);
            return q;
          },
          eq(key, value) {
            filters.push([key, value]);
            return q;
          },
          lte(key, value) {
            filters.push([key, value]);
            return q;
          },
          order() {
            return q;
          },
          async limit() {
            queried.push(table);
            const rows = queried.length === 1 ? pending : linked;
            selectedId = rows[0]?.order_id;
            return { data: rows, error: null };
          },
          async single() {
            return {
              data: {
                id: selectedId,
                number: selectedId,
                payment_status: 'approved',
                total_cents: 100,
              },
              error: null,
            };
          },
          update(patch) {
            updated.push(patch);
            return q;
          },
          then(resolve) {
            resolve({ error: null });
          },
        };
        return q;
      },
    };
    const { syncOlistOrder } = loadTypeScript('src/lib/integrations/olist-orders.ts', {
      'server-only': {},
      '@/lib/supabase/service': { createServiceClient: () => db },
      './olist': {
        olistRequest: async () => ({ pedido: { numero_ecommerce: selectedId, total_pedido: 1 } }),
        OlistError: class extends Error {},
      },
    });
    const result = await syncOlistOrder();
    return { filters, queried, updated, result };
  }
  const newOrder = { order_id: 'new', remote_id: '99', state: 'pending' };
  const first = await exercise([newOrder], []);
  assert.deepEqual(first.filters[0], ['state', ['pending', 'uncertain']]);
  assert.equal(first.queried.length, 1, 'linked orders cannot delay a pending order');
  assert.equal(first.result, 'linked');
  const before = Date.now();
  const second = await exercise([], [{ ...newOrder, state: 'linked' }]);
  assert.equal(second.queried.length, 2);
  assert.ok(second.filters.some(([key, value]) => key === 'state' && value === 'linked'));
  const deadline = Date.parse(second.filters.find(([key]) => key === 'updated_at')[1]);
  assert.ok(deadline >= before - 300_000 && deadline <= Date.now() - 300_000);
  assert.equal((await exercise([], [])).result, 'idle');
});
