const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('dated protocols preserve old references, distinguish repeat purchases and use the Brasilia calendar', async () => {
  const db = new PGlite();
  const buyer = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema private; create schema auth;
      grant usage on schema private to anon,authenticated,service_role;
      create table auth.users(id uuid primary key);
      insert into auth.users values('${buyer}'),('${other}');
      create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,number text not null unique,is_demo boolean not null default false,created_at timestamptz not null default now());
      insert into public.orders(user_id,number) values('${buyer}','STUW-1NLLAX');`);
    await db.exec(
      fs.readFileSync('supabase/migrations/20261015012816_short_order_numbers.sql', 'utf8'),
    );
    await db.exec(
      fs.readFileSync('supabase/migrations/20261016044039_dated_order_protocol.sql', 'utf8'),
    );
    const insert = async (userId, date) =>
      (
        await db.query(
          "insert into public.orders(user_id,number,created_at) values($1,'STUW-'||upper(replace(gen_random_uuid()::text,'-','')),$2) returning id,number",
          [userId, date],
        )
      ).rows[0];
    const first = await insert(buyer, '2026-10-16T02:59:59Z');
    const next = await insert(buyer, '2026-10-16T03:00:00Z');
    const again = await insert(buyer, '2026-10-16T03:00:00Z');
    const different = await insert(other, '2026-10-16T03:00:00Z');
    assert.match(first.number, /^STW-15102026[A-Z0-9]{6}01$/);
    assert.match(next.number, /^STW-16102026[A-Z0-9]{6}01$/);
    assert.equal(again.number.slice(-2), '02');
    assert.equal(next.number.slice(12, 18), again.number.slice(12, 18));
    assert.notEqual(next.number.slice(12, 18), different.number.slice(12, 18));
    assert.equal(new Set([first, next, again, different].map((v) => v.number)).size, 4);
    assert.ok(
      [first, next, again, different].every((v) => v.number.length === 20 && v.id.length === 36),
    );
    assert.equal(
      (await db.query("select number from public.orders where number='STUW-1NLLAX'")).rows.length,
      1,
    );
    // An imported reference occupying the next sequence is skipped.
    await db.query('insert into public.orders(user_id,number) values($1,$2)', [
      buyer,
      next.number.slice(0, -2) + '03',
    ]);
    assert.equal((await insert(buyer, '2026-10-16T04:00:00Z')).number.slice(-2), '04');
    const demo = (
      await db.query(
        "insert into public.orders(user_id,number,is_demo) values($1,'TESTE-'||upper(replace(gen_random_uuid()::text,'-','')),true) returning number",
        [buyer],
      )
    ).rows[0];
    assert.match(demo.number, /^TESTE-[A-Z0-9]{6}$/);
    await db.query(
      'update private.order_protocol_counters set last_value=34 where user_id=$1 and order_day=$2',
      [buyer, '2026-10-16'],
    );
    assert.equal((await insert(buyer, '2026-10-16T04:00:00Z')).number.slice(-2), '0Z');
    assert.equal((await insert(buyer, '2026-10-16T04:00:00Z')).number.slice(-2), '10');
    await db.query(
      'update private.order_protocol_counters set last_value=1295 where user_id=$1 and order_day=$2',
      [buyer, '2026-10-16'],
    );
    await assert.rejects(insert(buyer, '2026-10-16T04:00:00Z'), /check constraint/);
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query('select * from private.order_customer_codes'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select * from private.order_protocol_counters'),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select nextval('private.customer_protocol_sequence')"),
      /permission denied/,
    );
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
