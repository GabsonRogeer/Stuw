const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const { buildResetSql } = require('../scripts/prepare-production-catalog.cjs');
const { createProductionProducts } = loadTypeScript('src/data/production-products.ts');
const { validateProduct, toStoreProduct } = loadTypeScript('src/services/product-admin.ts');

test('21 production drafts match approved prices, colors, P/M/G, real media and unknown data', () => {
  const products = createProductionProducts();
  assert.equal(products.length, 21);
  assert.equal(new Set(products.map((p) => p.slug)).size, 21);
  const codes = [];
  for (const product of products) {
    assert.equal(validateProduct(product), null, product.slug);
    assert.equal(product.status, 'draft');
    assert.equal(
      product.price,
      { 'Tops/Croppeds': 70, Shorts: 80, Conjuntos: 150 }[product.category],
    );
    assert.equal(product.activityCategory, 'Activewear / Training');
    assert.deepEqual(product.sizes, ['P', 'M', 'G']);
    assert.equal(product.colors.length, 1);
    assert.equal(product.colors[0].skus.length, 3);
    for (const key of ['weight', 'height', 'width', 'length']) assert.equal(product[key], null);
    for (const key of ['composition', 'fabric', 'ncm', 'cest', 'measurements'])
      assert.equal(product[key], '');
    assert.equal('occasion' in product, false);
    assert.equal('occasion' in toStoreProduct(1, product), false);
    assert.ok(!product.description.includes('A CONFIRMAR'));
    assert.ok(product.colors[0].images.some((i) => i.role === 'frente'));
    for (const image of product.colors[0].images) {
      assert.ok(image.src.startsWith(`/products/stuw-${product.colors[0].slug}/`));
      assert.ok(fs.existsSync('public' + image.src), image.src);
      assert.ok(image.alt.length > 0 && image.alt.length <= 200);
    }
    for (const sku of product.colors[0].skus) {
      codes.push(sku.code);
      assert.equal(sku.stock, 0);
      assert.equal(sku.gtin, '');
      assert.equal(sku.price, null);
    }
    assert.match(validateProduct({ ...product, status: 'active' }), /peso e as dimensões/);
  }
  assert.equal(new Set(codes).size, 63);
  for (const category of ['Tops/Croppeds', 'Shorts', 'Conjuntos'])
    assert.equal(products.filter((p) => p.category === category).length, 7);
});

test('an unavailable database cannot resurrect the removed static catalog or expose drafts', async () => {
  const dependencies = { '@/lib/supabase/config': { isSupabaseConfigured: () => false } };
  const { productRepository, mergeCatalog } = loadTypeScript(
    'src/repositories/products.ts',
    dependencies,
  );
  const { resolveProductRoute } = loadTypeScript(
    'src/repositories/product-routes.ts',
    dependencies,
  );
  assert.deepEqual(mergeCatalog([]), []);
  assert.deepEqual(await productRepository.list(), []);
  assert.equal(await resolveProductRoute('legging-sculpt-pure-waist'), null);
  assert.equal(await resolveProductRoute('top-stuw-azul'), null);
});

test('catalog replacement is atomic, removes order/quote dependencies, preserves accounts and blocks replay', async () => {
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
      '20261012170807_category_management.sql',
      '20261012180829_checkout_integrations.sql',
    ])
      await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
    const uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    await db.query('insert into auth.users(id,email) values($1,$2)', [
      uid,
      'catalog-test@example.com',
    ]);
    await db.query('insert into private.admin_users(user_id) values($1)', [uid]);
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid }),
    ]);
    const original = { ...createProductionProducts()[2], slug: 'old-product' };
    await db.query('select public.save_product(null,0,$1::jsonb,null,null)', [
      JSON.stringify(original),
    ]);
    await db.exec(`insert into public.orders(id,user_id,number,total_cents,items) values
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','${uid}','OLD-ORDER',15000,'[{"sku":"STUW-CONJ-AZUL-P"}]');
      insert into public.order_events(order_id,status) values('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','pending');
      insert into public.checkout_shipping_quotes(id,user_id,context_hash,products,options) values
      ('cccccccc-cccc-cccc-cccc-cccccccccccc','${uid}','hash','[]','[]');
      insert into public.order_integrations(order_id,payment_fingerprint,quote_id,shipping_service) values
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','fingerprint','cccccccc-cccc-cccc-cccc-cccccccccccc','test');
      insert into public.coupons(id,code,percent,max_uses,used_count,expires_at) values
      ('dddddddd-dddd-dddd-dddd-dddddddddddd','TEST',10,100,1,now()+interval '1 day');
      insert into public.coupon_redemptions(order_id,coupon_id,coupon_code,percent,base_total_cents,discount_cents) values
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','dddddddd-dddd-dddd-dddd-dddddddddddd','TEST',10,15000,1500);
      insert into public.wholesale_quotes(id,user_id,request_key,number,customer_name,customer_email,phone,items,quantity,minimum_quantity) values
      ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','${uid}',gen_random_uuid(),'OLD-QUOTE','Test','test@example.com','11999999999','[{}]',1,1);
      insert into public.wholesale_quote_events(quote_id,status,note) values('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','received','test');
      insert into private.checkout_products(id,data) values(900000,'{}');`);
    const sql = buildResetSql();
    await assert.rejects(
      db.exec(
        sql.replace(
          'if (select count(*) from public.admin_products)<>21',
          'if true or (select count(*) from public.admin_products)<>21',
        ),
      ),
      /Quantidade inesperada/,
    );
    await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n, 1);
    assert.equal(
      (await db.query('select document from public.admin_products')).rows[0].document.slug,
      'old-product',
    );
    await db.exec(sql);
    const rows = (await db.query('select document from public.admin_products')).rows;
    assert.equal(rows.length, 21);
    assert.ok(
      rows.every((row) => row.document.status === 'draft' && !('occasion' in row.document)),
    );
    for (const table of [
      'public.orders',
      'public.order_events',
      'public.order_integrations',
      'public.checkout_shipping_quotes',
      'public.wholesale_quotes',
      'public.wholesale_quote_events',
      'public.coupon_redemptions',
      'private.checkout_products',
      'public.catalog_products',
    ]) {
      assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 0, table);
    }
    for (const table of ['auth.users', 'public.profiles', 'private.admin_users', 'public.coupons'])
      assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n, 1, table);
    assert.equal((await db.query('select used_count from public.coupons')).rows[0].used_count, 0);
    assert.equal(
      (await db.query('select count(*)::int n from private.product_skus')).rows[0].n,
      63,
    );
    assert.equal(
      (await db.query('select count(*)::int n from private.product_audit')).rows[0].n,
      21,
    );
    assert.equal(
      (await db.query('select count(*)::int n from public.product_categories')).rows[0].n,
      4,
    );
    await assert.rejects(db.exec(sql), /Um slug do novo catálogo já existe/);
    await db.exec('rollback');
    assert.equal(
      (await db.query('select count(*)::int n from public.admin_products')).rows[0].n,
      21,
    );
    await db.exec('set role anon');
    assert.deepEqual((await db.query('select * from public.catalog_products')).rows, []);
    await assert.rejects(db.query('select * from public.admin_products'), /permission denied/);
    await db.exec('reset role');
    for (const file of [
      '20261013212513_pix_expiration_margin.sql',
      '20261014215041_olist_catalog_sync.sql',
      '20261014234221_olist_simple_products_and_kits.sql',
    ])
      await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
    for (const row of (await db.query('select id,document from public.admin_products')).rows) {
      const projected = toStoreProduct(row.id, row.document);
      await db.query('insert into public.catalog_products(id,payload) values($1,$2)', [
        row.id,
        JSON.stringify({ regular: projected, promotion: projected }),
      ]);
    }
    // The failed reset above advances the identity sequence; bind the script's 21 fixed IDs to this fixture.
    const fixtureIds = (
      await db.query('select id from public.admin_products order by id')
    ).rows.map((r) => r.id);
    const simpleSql = fs
      .readFileSync('scripts/sql/olist-initial-simple-skus.sql', 'utf8')
      .replace(/\b10000\d\d\b/g, (id) => String(fixtureIds[Number(id) - 1000000]));
    await db.exec(simpleSql);
    await db.exec(simpleSql);
    assert.equal(
      (await db.query('select count(*)::int n from private.product_skus')).rows[0].n,
      84,
    );
    assert.equal(
      (await db.query('select count(*)::int n from private.product_kit_components')).rows[0].n,
      56,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from private.product_skus where size='GG' and stock=0",
        )
      ).rows[0].n,
      21,
    );
    assert.equal(
      (
        await db.query(
          "select jsonb_array_length(payload->'regular'->'variants') n from public.catalog_products limit 1",
        )
      ).rows[0].n,
      4,
    );
  } finally {
    await db.close();
  }
});
