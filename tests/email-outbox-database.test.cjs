const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('outbox queues only production approvals, deduplicates and rejects customer access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private;
      create table public.orders(id uuid primary key, payment_status text, is_demo boolean, payment_test_mode boolean);
      insert into public.orders values
      ('00000000-0000-0000-0000-000000000001','pending',false,false),
      ('00000000-0000-0000-0000-000000000002','pending',false,true),
      ('00000000-0000-0000-0000-000000000003','pending',true,false);`);
    await db.exec(
      fs.readFileSync('supabase/migrations/20261014212138_transactional_email_outbox.sql', 'utf8'),
    );
    await db.exec("update public.orders set payment_status='approved'");
    assert.equal((await db.query('select * from public.email_outbox')).rows.length, 1);
    await db.exec(
      "update public.orders set payment_status='approved'; update public.orders set payment_status='refunded'; update public.orders set payment_status='approved';",
    );
    assert.equal((await db.query('select * from public.email_outbox')).rows.length, 1);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await assert.rejects(
        () => db.query('select * from public.email_outbox'),
        /permission denied/,
      );
      await assert.rejects(
        () => db.exec("update public.email_outbox set status='sent'"),
        /permission denied/,
      );
      await assert.rejects(
        () => db.exec('select private.enqueue_purchase_email()'),
        /permission denied/,
      );
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const first = await db.query(
      "update public.email_outbox set status='sending',attempts=1 where status='pending' and attempts=0 returning id",
    );
    const second = await db.query(
      "update public.email_outbox set status='sending',attempts=1 where status='pending' and attempts=0 returning id",
    );
    assert.equal(first.rows.length, 1);
    assert.equal(second.rows.length, 0);
    await assert.rejects(
      () =>
        db.exec(
          "insert into public.email_outbox(order_id) values('00000000-0000-0000-0000-000000000002')",
        ),
      /permission denied/,
    );
    await db.exec('reset role');
    await db.exec(
      "begin; insert into public.orders values('00000000-0000-0000-0000-000000000004','pending',false,false); update public.orders set payment_status='approved' where id='00000000-0000-0000-0000-000000000004'; rollback;",
    );
    assert.equal((await db.query('select * from public.email_outbox')).rows.length, 1);
  } finally {
    await db.close();
  }
});
