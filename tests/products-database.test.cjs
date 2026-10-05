const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('Postgres product permissions, atomic variants, slug history, revisions, draft isolation and archival', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema auth to anon,authenticated,service_role;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid; $$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated;`);
    for (const file of [
      '202609250001_identity.sql',
      '202609280001_profile_name.sql',
      '20260928135940_account_area.sql',
      '20260928141620_coupons.sql',
      '20260928154600_orders_management.sql',
      '20260928184320_unlimited_coupons.sql',
      '20260928185642_wholesale_quotes.sql',
      '20261005172919_product_catalog.sql',
    ])
      await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
    const uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    for (const file of ['orders.sql', 'wholesale.sql'])
      await db.exec(fs.readFileSync('supabase/tests/' + file, 'utf8'));
    await db.query('insert into auth.users(id,email) values($1,$2)', [uid, 'admin@example.com']);
    await db.query('insert into private.admin_users(user_id) values($1)', [uid]);
    const document = {
      name: 'Sculpt',
      slug: 'sculpt',
      status: 'active',
      wholesaleMinimum: 2,
      wholesalePrice: 60,
      wholesalePack: 'Cores e tamanhos combináveis',
      colors: [
        {
          name: 'Mocha',
          slug: 'mocha',
          skus: [{ size: 'P', code: 'SCULPT-P', gtin: '', stock: 2, price: null, active: true }],
        },
      ],
    };
    const product = {
      id: 0,
      title: 'Sculpt',
      slug: 'sculpt',
      image: '/products/sculpt.webp',
      variants: [{ color: 'Mocha', size: 'P', stock: 2, price: 100 }],
    };
    const payload = {
      regular: product,
      promotion: { ...product, variants: [{ ...product.variants[0], price: 80 }] },
      saleStart: '',
      saleEnd: '',
    };
    const save = (id, revision, doc = document, publicData = payload, legacy = null) =>
      db.query('select public.save_product($1,$2,$3::jsonb,$4::jsonb,$5) as id', [
        id,
        revision,
        JSON.stringify(doc),
        JSON.stringify(publicData),
        legacy,
      ]);
    await db.exec('set role anon');
    await assert.rejects(save(null, 0), /permission denied/);
    await db.exec('set role authenticated');
    await assert.rejects(save(null, 0), /insufficient_privilege|permission denied/);
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid }),
    ]);
    const id = (await save(null, 0)).rows[0].id;
    assert.ok(id >= 1000000);
    assert.equal(
      (await db.query('select count(*)::int n from public.admin_products')).rows[0].n,
      1,
    );
    await assert.rejects(save(id, 0), /Invalid legacy identity/);
    await assert.rejects(save(id, 2), /Revision conflict/);
    await assert.rejects(save(null, 0), /unique|duplicate/i);
    const duplicate = { ...document, slug: 'another-model' };
    await assert.rejects(save(null, 0, duplicate), (e) => e.code === '23505');
    assert.equal(
      (await db.query('select count(*)::int n from public.admin_products')).rows[0].n,
      1,
    );
    await save(id, 1, { ...document, name: 'Editorial draft', status: 'draft' });
    assert.equal(
      (await db.query('select payload from public.catalog_products where id=$1', [id])).rows[0]
        .payload.regular.title,
      'Sculpt',
    );
    await save(
      id,
      2,
      { ...document, slug: 'sculpt-new' },
      { ...payload, regular: { ...product, slug: 'sculpt-new' } },
      'sculpt-legacy',
    );
    const aliases = (
      await db.query('select aliases from public.catalog_products where id=$1', [id])
    ).rows[0].aliases;
    assert.ok(aliases.includes('sculpt'));
    assert.ok(aliases.includes('sculpt-legacy'));
    assert.ok(aliases.includes('sculpt-new'));
    await db.exec('reset role');
    await db.exec('update public.wholesale_settings set minimum_quantity=1 where id=true');
    await db.exec('set role authenticated');
    const quote = {
      key: '11111111-1111-1111-1111-111111111111',
      name: 'Teste',
      phone: '11999999999',
      items: [{ id, color: 'Mocha', size: 'P', qty: 1 }],
    };
    await assert.rejects(
      db.query('select public.create_wholesale_quote($1::jsonb)', [JSON.stringify(quote)]),
      /Product minimum: 2/,
    );
    quote.items[0].qty = 2;
    const quoteId = (
      await db.query('select public.create_wholesale_quote($1::jsonb) id', [JSON.stringify(quote)])
    ).rows[0].id;
    assert.equal(
      (await db.query('select items from public.wholesale_quotes where id=$1', [quoteId])).rows[0]
        .items[0].wholesale_price_cents,
      6000,
    );
    await db.exec('reset role');
    assert.equal(
      (await db.query("select private.checkout_product_variant($1,'Mocha','P',2) p", [id])).rows[0]
        .p.price_cents,
      10000,
    );
    assert.equal(
      (await db.query("select private.checkout_product_variant($1,'Mocha','M',1) p", [id])).rows[0]
        .p,
      null,
    );
    assert.equal(
      (await db.query("select private.checkout_product_variant($1,'Mocha','P',3) p", [id])).rows[0]
        .p,
      null,
    );
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.admin_products'), /permission denied/);
    await assert.rejects(db.query('select * from private.product_audit'), /permission denied/);
    assert.equal(
      (await db.query('select count(*)::int n from public.catalog_products')).rows[0].n,
      1,
    );
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claims','{}',false)");
    assert.equal(
      (await db.query('select count(*)::int n from public.admin_products')).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query('select public.archive_product($1,3)', [id]),
      /insufficient_privilege|permission denied/,
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid }),
    ]);
    await db.query('select public.archive_product($1,3)', [id]);
    assert.equal(
      (await db.query('select payload from public.catalog_products where id=$1', [id])).rows[0]
        .payload,
      null,
    );
    await assert.rejects(save(id, 4), /Revision conflict/);
    await db.exec('reset role');
    assert.equal(
      (
        await db.query('select count(*)::int n from private.product_audit where product_id=$1', [
          id,
        ])
      ).rows[0].n,
      4,
    );
  } finally {
    await db.close();
  }
});
