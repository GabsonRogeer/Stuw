const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('commerce scheduler restricts destinations, protects secrets and starts jobs disabled', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create schema vault; create schema net; create schema cron;
      grant usage on schema private to anon,authenticated,service_role;
      create table vault.decrypted_secrets(name text,decrypted_secret text);
      insert into vault.decrypted_secrets values ('stuw_olist_cron_secret','01234567890123456789012345678901');
      create table net.requests(id bigint generated always as identity,url text,headers jsonb,timeout integer);
      create function net.http_get(url text,headers jsonb,timeout_milliseconds integer) returns bigint language sql as $$ insert into net.requests(url,headers,timeout) values(url,headers,timeout_milliseconds) returning id $$;
      create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text,active boolean default true);
      create function cron.schedule(name text,schedule text,command text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values(name,schedule,command) returning jobid $$;
      create function cron.alter_job(job bigint,active boolean) returns void language sql as $$ update cron.job set active=$2 where jobid=$1 $$;`);
    await db.exec(
      fs.readFileSync('supabase/migrations/20261016002431_commerce_background_jobs.sql', 'utf8'),
    );
    assert.equal((await db.query('select * from cron.job where active')).rows.length, 0);
    assert.equal((await db.query('select * from cron.job')).rows.length, 3);
    for (const kind of ['payments', 'emails', 'orders'])
      await db.query('select private.run_commerce_job($1)', [kind]);
    const requests = (await db.query('select * from net.requests order by id')).rows;
    assert.deepEqual(
      requests.map((r) => r.url),
      [
        'https://stuw.vercel.app/api/jobs/commerce',
        'https://stuw.vercel.app/api/jobs/email',
        'https://stuw.vercel.app/api/jobs/olist?direction=orders',
      ],
    );
    assert.ok(
      requests.every(
        (r) =>
          r.headers.Authorization === 'Bearer 01234567890123456789012345678901' &&
          r.timeout === 50000,
      ),
    );
    await assert.rejects(
      db.query('select private.run_commerce_job($1)', ['https://untrusted.example']),
      /Unknown/,
    );
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query("select private.run_commerce_job('orders')"),
      /permission denied/,
    );
    await assert.rejects(db.query('select * from private.commerce_job_runs'), /permission denied/);
    await db.exec('reset role; set role service_role');
    assert.equal((await db.query('select * from private.commerce_job_runs')).rows.length, 3);
    await assert.rejects(
      db.query("select private.run_commerce_job('orders')"),
      /permission denied/,
    );
    await db.exec('reset role; delete from vault.decrypted_secrets');
    await assert.rejects(
      db.query("select private.run_commerce_job('orders')"),
      /secret not configured/,
    );
  } finally {
    await db.close();
  }
});
