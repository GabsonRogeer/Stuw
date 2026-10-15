const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('short order numbers are unique, preserve old references, skip occupied codes and keep UUID identity', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema private;
      create table public.orders(id uuid primary key default gen_random_uuid(), number text not null unique, is_demo boolean not null default false);
      insert into public.orders(number) values('STUW-4EA75AA2159D4FF7ACF5CBCCB5342D9A');`);
    await db.exec(
      fs.readFileSync('supabase/migrations/20261015012816_short_order_numbers.sql', 'utf8'),
    );
    const original = (await db.query('select * from public.orders')).rows[0];
    const numbers = (
      await db.query(
        "insert into public.orders(number) select 'STUW-'||upper(replace(gen_random_uuid()::text,'-','')) from generate_series(1,500) returning id,number",
      )
    ).rows;
    assert.equal(new Set(numbers.map((r) => r.number)).size, 500);
    assert.ok(numbers.every((r) => /^STUW-[A-Z0-9]{6}$/.test(r.number)));
    assert.ok(numbers.every((r) => r.id.length === 36));
    assert.deepEqual(
      (await db.query('select * from public.orders where id=$1', [original.id])).rows[0],
      original,
    );
    await db.query("select setval('private.order_code_sequence',1,false)");
    const skipped = (
      await db.query(
        "insert into public.orders(number) values('STUW-'||upper(replace(gen_random_uuid()::text,'-',''))) returning number",
      )
    ).rows[0].number;
    assert.ok(!numbers.some((r) => r.number === skipped));
    const demo = (
      await db.query(
        "insert into public.orders(number,is_demo) values('TESTE-'||upper(replace(gen_random_uuid()::text,'-','')),true) returning number",
      )
    ).rows[0].number;
    assert.match(demo, /^TESTE-[A-Z0-9]{6}$/);
    await db.exec("insert into public.orders(number) values('EXTERNAL-123'); set role anon");
    await assert.rejects(db.query("select nextval('private.order_code_sequence')"), /permission/);
  } finally {
    await db.close();
  }
});
