const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('numeric protocols preserve history and customer identity, include Brasilia time and serialize repeat orders', async () => {
  const db = new PGlite();
  const buyer = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const large = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const insert = async (user, date) =>
    (
      await db.query(
        "insert into public.orders(user_id,number,created_at) values($1,'STUW-'||upper(replace(gen_random_uuid()::text,'-','')),$2) returning id,number",
        [user, date],
      )
    ).rows[0];
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema private; create schema auth;
      grant usage on schema private to anon,authenticated,service_role;
      create table auth.users(id uuid primary key);
      insert into auth.users values('${buyer}'),('${other}'),('${large}');
      create table public.orders(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users,number text not null unique,is_demo boolean not null default false,created_at timestamptz not null default now());
      insert into public.orders(user_id,number) values('${buyer}','STUW-1NLLAX');`);
    for (const file of [
      '20261015012816_short_order_numbers.sql',
      '20261016044039_dated_order_protocol.sql',
    ])
      await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
    const old = await insert(buyer, '2026-10-16T04:37:00Z');
    const oldMapping = (
      await db.query('select code from private.order_customer_codes where user_id=$1', [buyer])
    ).rows[0].code;
    await db.exec(
      fs.readFileSync('supabase/migrations/20261016045944_numeric_order_protocol.sql', 'utf8'),
    );
    const mapping = (
      await db.query('select code,protocol_id from private.order_customer_codes where user_id=$1', [
        buyer,
      ])
    ).rows[0];
    assert.equal(mapping.code, oldMapping);
    assert.ok(Number(mapping.protocol_id) > 0);
    const first = await insert(buyer, '2026-10-16T04:37:00Z');
    const again = await insert(buyer, '2026-10-16T04:37:00Z');
    const different = await insert(other, '2026-10-16T04:37:00Z');
    assert.match(first.number, /^STW-161020260137\d{6}0002$/);
    assert.equal(again.number.slice(-4), '0003');
    assert.equal(first.number.slice(16, -4), again.number.slice(16, -4));
    assert.notEqual(first.number.slice(16, -4), different.number.slice(16, -4));
    assert.equal(new Set([old, first, again, different].map((v) => v.number)).size, 4);
    assert.equal(first.number.length, 26);
    assert.equal(first.id.length, 36);
    assert.equal(
      (await db.query('select number from public.orders where id=$1', [old.id])).rows[0].number,
      old.number,
    );
    assert.equal(
      (await db.query("select count(*)::int as n from public.orders where number='STUW-1NLLAX'"))
        .rows[0].n,
      1,
    );
    const beforeMidnight = await insert(buyer, '2026-10-17T02:59:59Z');
    const afterMidnight = await insert(buyer, '2026-10-17T03:00:00Z');
    assert.match(beforeMidnight.number, /^STW-161020262359\d{6}0004$/);
    assert.match(afterMidnight.number, /^STW-171020260000\d{6}0001$/);
    // Preserve an imported reference and skip its occupied sequence.
    await db.query('insert into public.orders(user_id,number) values($1,$2)', [
      buyer,
      afterMidnight.number.slice(0, -4) + '0002',
    ]);
    assert.equal((await insert(buyer, '2026-10-17T03:00:00Z')).number.slice(-4), '0003');
    await db.query(
      'update private.order_protocol_counters set last_value=34 where user_id=$1 and order_day=$2',
      [buyer, '2026-10-17'],
    );
    assert.equal((await insert(buyer, '2026-10-17T03:00:00Z')).number.slice(-4), '0035');
    assert.equal((await insert(buyer, '2026-10-17T03:00:00Z')).number.slice(-4), '0036');
    await db.exec(
      'alter sequence private.order_customer_codes_protocol_id_seq restart with 1000000',
    );
    assert.match(
      (await insert(large, '2026-10-17T03:00:00Z')).number,
      /^STW-17102026000010000000001$/,
    );
    const demo = (
      await db.query(
        "insert into public.orders(user_id,number,is_demo) values($1,'TESTE-'||upper(replace(gen_random_uuid()::text,'-','')),true) returning number",
        [buyer],
      )
    ).rows[0];
    assert.match(demo.number, /^TESTE-[A-Z0-9]{6}$/);
    await db.query(
      'update private.order_protocol_counters set last_value=9998 where user_id=$1 and order_day=$2',
      [buyer, '2026-10-17'],
    );
    assert.equal((await insert(buyer, '2026-10-17T03:00:00Z')).number.slice(-4), '9999');
    await assert.rejects(insert(buyer, '2026-10-17T03:00:00Z'), /check constraint/);
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await assert.rejects(
        db.query('select protocol_id from private.order_customer_codes'),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select nextval('private.order_customer_codes_protocol_id_seq')"),
        /permission denied/,
      );
      assert.equal(
        (
          await db.query(
            "select has_function_privilege(current_user,'private.assign_dated_order_protocol()','execute') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
      await db.exec('reset role');
    }
  } finally {
    await db.close();
  }
});
