const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
test('Postgres: orders, atomic totals, coupon limits, idempotency, RLS and audited transitions', async () => {
  const db = new PGlite();
  try {
    // Reproduce the Supabase auth primitives locally; no remote credentials or writes.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to anon,authenticated,service_role;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
      $$;`);
    for (const file of [
      '202609250001_identity.sql',
      '202609280001_profile_name.sql',
      '20260928135940_account_area.sql',
      '20260928141620_coupons.sql',
      '20260928154600_orders_management.sql',
      '20260928184320_unlimited_coupons.sql',
      '20260928185642_wholesale_quotes.sql',
    ])
      await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations', file), 'utf8'));
    for (const file of [
      'account.sql',
      'coupons.sql',
      'orders.sql',
      'unlimited-coupons.sql',
      'wholesale.sql',
    ])
      await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/tests', file), 'utf8'));
  } finally {
    await db.close();
  }
});
