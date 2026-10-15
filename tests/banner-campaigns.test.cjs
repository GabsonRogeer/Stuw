const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('campaign migration preserves the current banner; independent publishing, scheduling and deletion enforce RLS', async () => {
  const db = new PGlite();
  const admin = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const customer = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const asset = 'home/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg';
  const query = (sql, params) => db.query(sql, params);
  const rows = async (sql, params) => (await query(sql, params)).rows;
  async function role(name, uid = '') {
    await db.exec('reset role');
    await query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid || null }),
    ]);
    await db.exec('set role ' + name);
  }
  const change = async (draft, operation) =>
    (
      await rows('select * from public.change_banner_campaign($1,$2,$3)', [
        draft.id,
        draft.revision,
        operation,
      ])
    )[0];
  async function create(title, starts = null, ends = null) {
    return (
      await rows(
        `insert into public.banner_campaigns(slot,title,link,desktop_path,mobile_path,layout,starts_at,ends_at)
      values('home',$1,'/produtos',$2,$2,'image',$3,$4) returning *`,
        [title, asset, starts, ends],
      )
    )[0];
  }
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to anon,authenticated,service_role;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid; $$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated;`);
    for (const file of [
      '202609250001_identity.sql',
      '20260928145859_banners.sql',
      '20260928153112_banner_text_fields.sql',
    ])
      await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
    await query('insert into auth.users(id) values($1),($2)', [admin, customer]);
    await query('insert into private.admin_users(user_id) values($1)', [admin]);
    await query("insert into storage.objects(bucket_id,name) values('site-banners',$1)", [asset]);
    await role('authenticated', admin);
    await query(
      "insert into public.banner_drafts(slot,title,link,desktop_path,mobile_path) values('home','Original no ar','/produtos',$1,$1)",
      [asset],
    );
    await query('select public.publish_home_banner(1)');
    await query("update public.banner_drafts set title='Edição ainda não publicada'");
    await db.exec('reset role');
    await db.exec(
      fs.readFileSync('supabase/migrations/20261013055416_home_banner_campaigns.sql', 'utf8'),
    );
    await db.exec(
      fs.readFileSync('supabase/migrations/20261015035455_banner_vertical_position.sql', 'utf8'),
    );
    const legacy = (await rows('select * from public.banner_campaigns'))[0];
    assert.equal(legacy.title, 'Edição ainda não publicada');
    assert.equal(
      (await rows('select title from public.banner_publications'))[0].title,
      'Original no ar',
    );
    assert.equal(legacy.layout, 'split');
    assert.equal(legacy.desktop_position_y, 0);
    await role('authenticated', admin);
    let first = await create('Primeira campanha');
    let second = await create('Segunda campanha');
    first = await change(first, 'publish');
    second = await change(second, 'publish');
    first = (
      await rows(
        'update public.banner_campaigns set desktop_position_y=20 where id=$1 returning *',
        [first.id],
      )
    )[0];
    assert.equal(
      (
        await rows('select desktop_position_y from public.banner_publications where id=$1', [
          first.id,
        ])
      )[0].desktop_position_y,
      0,
    );
    first = await change(first, 'publish');
    assert.equal(
      (
        await rows('select desktop_position_y from public.banner_publications where id=$1', [
          first.id,
        ])
      )[0].desktop_position_y,
      20,
    );
    await assert.rejects(
      query('update public.banner_campaigns set desktop_position_y=101 where id=$1', [first.id]),
      /check constraint/,
    );

    assert.equal((await rows('select * from public.banner_publications')).length, 3);
    assert.equal(
      (await rows('select * from public.banner_publications where id=$1', [first.id]))[0].layout,
      'image',
    );
    await assert.rejects(change({ ...first, revision: first.revision - 1 }, 'delete'), /changed/);
    await assert.rejects(change({ ...first, revision: null }, 'publish'), /changed/);
    first = (
      await rows(
        "update public.banner_campaigns set title='Alteração privada' where id=$1 returning *",
        [first.id],
      )
    )[0];
    assert.equal(
      (await rows('select title from public.banner_publications where id=$1', [first.id]))[0].title,
      'Primeira campanha',
    );
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const afterTomorrow = new Date(Date.now() + 172800000).toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const future = await create('Campanha futura', tomorrow, afterTomorrow);
    await change(future, 'publish');
    const expired = await create('Encerrada', null, yesterday);
    await assert.rejects(change(expired, 'publish'), /has ended/);
    await assert.rejects(create('Período inválido', afterTomorrow, tomorrow), /check constraint/);
    await assert.rejects(
      query('update public.banner_campaigns set deleted_at=now() where id=$1', [first.id]),
      /permission denied/,
    );
    await assert.rejects(
      query('delete from public.banner_publications where id=$1', [first.id]),
      /permission denied/,
    );
    // Advance one published campaign's end in the owner fixture, then test public RLS.
    await db.exec('reset role');
    await query('update public.banner_publications set ends_at=$1 where id=$2', [
      yesterday,
      second.id,
    ]);
    await role('anon');
    assert.deepEqual(
      (await rows('select id from public.banner_publications order by id'))
        .map((row) => row.id)
        .sort(),
      [legacy.id, first.id].sort(),
    );
    await assert.rejects(query('select * from public.banner_campaigns'), /permission denied/);
    await assert.rejects(change(first, 'delete'), /permission denied/);
    await role('authenticated', customer);
    assert.equal((await rows('select * from public.banner_campaigns')).length, 0);
    assert.equal((await rows('select * from public.banner_publications')).length, 2);
    await assert.rejects(create('Não permitido'), /row-level security/);
    await assert.rejects(change(first, 'publish'), /insufficient_privilege|permission denied/);
    await role('authenticated', admin);
    assert.equal((await rows('select * from public.banner_publications')).length, 4);
    first = await change(first, 'unpublish');
    assert.equal(
      (await rows('select * from public.banner_campaigns where id=$1', [first.id])).length,
      1,
    );
    assert.equal(
      (await rows('select * from public.banner_publications where id=$1', [first.id])).length,
      0,
    );
    first = await change(first, 'publish');
    assert.equal(
      (await rows('select title from public.banner_publications where id=$1', [first.id]))[0].title,
      'Alteração privada',
    );
    await change(first, 'delete');
    assert.equal(
      (await rows('select * from public.banner_campaigns where id=$1', [first.id])).length,
      0,
    );
    assert.equal(
      (await rows('select * from public.banner_publications where id=$1', [first.id])).length,
      0,
    );
    assert.equal(
      (await rows('select * from public.banner_publications where id=$1', [second.id])).length,
      1,
    );
    await assert.rejects(change(first, 'publish'), /changed/);
    const missing = (
      await rows(
        "update public.banner_campaigns set desktop_path='home/cccccccc-cccc-cccc-cccc-cccccccccccc.png' where id=$1 returning *",
        [expired.id],
      )
    )[0];
    const ready = (
      await rows('update public.banner_campaigns set ends_at=null where id=$1 returning *', [
        missing.id,
      ])
    )[0];
    await assert.rejects(change(ready, 'publish'), /Upload both images/);
    assert.equal(
      (await rows('select * from public.banner_publications where id=$1', [ready.id])).length,
      0,
    );
  } finally {
    await db.close();
  }
});
