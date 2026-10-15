const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { databaseWebhook } = require('./helpers/database-webhook.cjs');

test('real checkout: trusted quotes, atomic inventory, idempotency, provider transitions and customer isolation', async () => {
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
      '20261013212513_pix_expiration_margin.sql',
      '20261014212138_transactional_email_outbox.sql',
      '20261014215041_olist_catalog_sync.sql',
      '20261014234221_olist_simple_products_and_kits.sql',
      '20261015003758_olist_inventory_reconciliation.sql',
    ])
      await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
    const uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
      uid,
      'buyer@example.com',
      other,
      'other@example.com',
    ]);
    await db.query('insert into private.admin_users(user_id) values($1)', [uid]);
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid }),
    ]);
    await db.exec('set role authenticated');
    const document = {
      name: 'Sculpt',
      slug: 'sculpt-real',
      category: 'Conjuntos',
      activityCategory: 'Activewear / Training',
      status: 'active',
      weight: 300,
      width: 20,
      height: 4,
      length: 30,
      wholesaleMinimum: 1,
      colors: [
        {
          name: 'Black',
          slug: 'black',
          skus: [{ size: 'P', code: 'REAL-P', gtin: '', stock: 3, price: null, active: true }],
        },
      ],
    };
    const product = {
      id: 0,
      title: 'Sculpt',
      image: '/products/sculpt.webp',
      variants: [{ color: 'Black', size: 'P', sku: 'REAL-P', stock: 3, price: 100 }],
    };
    const id = (
      await db.query('select public.save_product(null,0,$1::jsonb,$2::jsonb,null) id', [
        JSON.stringify(document),
        JSON.stringify({ regular: product, promotion: product, saleStart: '', saleEnd: '' }),
      ])
    ).rows[0].id;
    await db.exec('reset role');
    const quoted = {
      id,
      title: 'Sculpt',
      image: '/products/sculpt.webp',
      size: 'P',
      color: 'Black',
      qty: 1,
      sku: 'REAL-P',
      price_cents: 10000,
      weight: 300,
      width: 20,
      height: 4,
      length: 30,
    };
    const quote = (
      await db.query(
        "insert into public.checkout_shipping_quotes(user_id,context_hash,products,options) values($1,'hash',$2::jsonb,$3::jsonb) returning id",
        [
          uid,
          JSON.stringify([quoted]),
          JSON.stringify([
            { id: 'me:1', name: 'Correios PAC', price: 20, deliveryEstimate: '5 dias úteis' },
          ]),
        ],
      )
    ).rows[0].id;
    const request = {
      key: '11111111-1111-4111-8111-111111111111',
      quoteId: quote,
      information: {
        firstName: 'Cliente',
        lastName: 'STUW',
        postalCode: '01001000',
        street: 'Rua A',
        number: '1',
        complement: '',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        phone: '11999999999',
      },
      items: [{ id, size: 'P', color: 'Black', qty: 1 }],
      shipping: 'me:1',
      payment: 'pix',
      installments: 1,
      gift: false,
      giftWrap: false,
      coupon: '',
      expectedTotal: 11500,
    };
    const create = (r = request, fingerprint = 'fingerprint', user = uid) =>
      db.query('select public.create_checkout_order($1,$2::jsonb,$3,$4) id', [
        user,
        JSON.stringify(r),
        fingerprint,
        'payment-hash',
      ]);
    await db.exec('set role authenticated');
    await assert.rejects(create(), /permission denied/);
    await assert.rejects(
      db.query('select * from public.checkout_shipping_quotes'),
      /permission denied/,
    );
    await assert.rejects(db.query('select * from public.order_integrations'), /permission denied/);
    await db.exec('set role service_role');
    await assert.rejects(create({ ...request, expectedTotal: 1 }), /Total changed/);
    assert.equal(
      (await db.query("select stock from private.product_skus where code='REAL-P'")).rows[0].stock,
      3,
    );
    await assert.rejects(create(request, 'other', other), /Quote expired/);
    await assert.rejects(create({ ...request, shipping: 'me:999' }), /Invalid shipping/);
    const order = (await create()).rows[0].id;
    const persistedExpiry = async () =>
      (await db.query('select payment_expires_at from public.orders where id=$1', [order])).rows[0]
        .payment_expires_at;
    const initialExpiry = await persistedExpiry();
    const remaining = new Date(initialExpiry).getTime() - Date.now();
    assert.ok(remaining > 34 * 60000 && remaining <= 35 * 60000, 'persisted Pix transport margin');
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query('select public.save_product($1,2,$2::jsonb,$3::jsonb,null)', [
        id,
        JSON.stringify(document),
        JSON.stringify({ regular: product, promotion: product, saleStart: '', saleEnd: '' }),
      ]),
      /Pending checkout|Unreconciled checkout/,
    );
    await db.exec('set role service_role');
    assert.equal((await create()).rows[0].id, order);
    assert.deepEqual(
      await persistedExpiry(),
      initialExpiry,
      'a retry must not extend the deadline',
    );
    assert.equal(
      (await create({ ...request, key: '22222222-2222-4222-8222-222222222222' })).rows[0].id,
      order,
    );
    await assert.rejects(
      create({ ...request, expectedTotal: 11000 }, 'different'),
      /Checkout changed/,
    );
    assert.equal(
      (await db.query("select stock from private.product_skus where code='REAL-P'")).rows[0].stock,
      2,
    );
    const live = (await db.query('select payload from public.catalog_products where id=$1', [id]))
      .rows[0].payload;
    assert.equal(live.regular.variants[0].stock, 2);
    assert.equal(live.promotion.variants[0].stock, 2);
    assert.equal(
      (await db.query('select document from public.admin_products where id=$1', [id])).rows[0]
        .document.colors[0].skus[0].stock,
      2,
    );
    const apply = (status, time, pid = '987') =>
      db.query('select public.apply_checkout_payment($1,$2,$3,$4)', [order, pid, status, time]);
    await db.exec('set role authenticated');
    await assert.rejects(apply('approved', '2026-10-12T10:00:00Z'), /permission denied/);
    await assert.rejects(
      db.query("select public.update_order($1,0,'paid','','')", [order]),
      /Provider-managed/,
    );
    await assert.rejects(
      db.query("select private.update_order($1,0,'paid','','')", [order]),
      /Provider-managed/,
    );
    await db.exec('set role service_role');
    const deliver = databaseWebhook(db);
    const providerPayment = {
      id: 987,
      external_reference: order,
      status: 'approved',
      transaction_amount: 115,
      currency_id: 'BRL',
      collector_id: 123,
      live_mode: false,
      payment_method_id: 'pix',
      date_last_updated: '2026-10-12T10:00:00Z',
    };
    await deliver(providerPayment);
    await apply('pending', '2026-10-12T11:00:00Z');
    await assert.rejects(
      apply('approved', '2026-10-12T12:00:00Z', 'other-payment'),
      /Payment mismatch/,
    );
    assert.equal(
      (await db.query('select status from public.orders where id=$1', [order])).rows[0].status,
      'paid',
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.order_events where order_id=$1 and status='payment_approved'",
          [order],
        )
      ).rows[0].n,
      1,
    );
    const label = '33333333-3333-4333-8333-333333333333';
    const ship = (status) =>
      db.query('select public.apply_checkout_shipment($1,$2,$3,$4)', [
        order,
        label,
        status,
        'BR123',
      ]);
    for (const status of ['label_generated', 'in_transit', 'label_generated']) await ship(status);
    await apply('refunded', '2026-10-12T13:00:00Z');
    await ship('delivered');
    await ship('in_transit');
    assert.equal(
      (await db.query('select shipment_status from public.orders where id=$1', [order])).rows[0]
        .shipment_status,
      'delivered',
    );
    assert.equal(
      (await db.query("select stock from private.product_skus where code='REAL-P'")).rows[0].stock,
      2,
      'refund does not restock a shipped product',
    );
    const second = (
      await create({ ...request, key: '44444444-4444-4444-8444-444444444444' }, 'second')
    ).rows[0].id;
    await assert.rejects(
      db.query('select public.apply_checkout_shipment($1,$2,$3,$4)', [
        second,
        '55555555-5555-4555-8555-555555555555',
        'label_generated',
        'BR456',
      ]),
      /Paid order required/,
    );
    await db.query(
      "select public.apply_checkout_payment($1,'988','rejected','2026-10-12T14:00:00Z')",
      [second],
    );
    await db.query(
      "select public.apply_checkout_payment($1,'988','rejected','2026-10-12T15:00:00Z')",
      [second],
    );
    assert.equal(
      (await db.query("select stock from private.product_skus where code='REAL-P'")).rows[0].stock,
      2,
      'rejection restores stock exactly once',
    );
    await assert.rejects(
      db.query("select public.apply_checkout_payment($1,'988','approved','2026-10-12T16:00:00Z')", [
        second,
      ]),
      /stock release/,
    );
    // Expiration is confirmed by a provider cancellation, never by the client clock.
    await db.query(
      "insert into public.coupons(code,percent,max_uses,expires_at) values('HOMOLOG10',10,5,now()+interval '1 day')",
    );
    const expired = (
      await create(
        {
          ...request,
          key: '66666666-6666-4666-8666-666666666666',
          coupon: 'HOMOLOG10',
          expectedTotal: 10350,
        },
        'expired-pix',
      )
    ).rows[0].id;
    await db.query(
      "update public.orders set payment_expires_at=now()-interval '1 minute' where id=$1",
      [expired],
    );
    await deliver({
      ...providerPayment,
      id: 989,
      external_reference: expired,
      status: 'pending',
      transaction_amount: 103.5,
    });
    assert.equal(
      (await db.query("select stock from private.product_skus where code='REAL-P'")).rows[0].stock,
      1,
    );
    assert.equal(
      (await db.query("select used_count from public.coupons where code='HOMOLOG10'")).rows[0]
        .used_count,
      1,
    );
    await deliver({
      ...providerPayment,
      id: 989,
      external_reference: expired,
      status: 'cancelled',
      transaction_amount: 103.5,
      date_last_updated: '2026-10-12T11:00:00Z',
    });
    assert.equal(
      (await db.query('select status from public.orders where id=$1', [expired])).rows[0].status,
      'cancelled',
    );
    assert.equal(
      (await db.query("select stock from private.product_skus where code='REAL-P'")).rows[0].stock,
      2,
    );
    assert.equal(
      (await db.query("select used_count from public.coupons where code='HOMOLOG10'")).rows[0]
        .used_count,
      0,
    );
    assert.equal(
      (
        await db.query('select count(*)::int n from public.coupon_redemptions where order_id=$1', [
          expired,
        ])
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.order_events where order_id=$1 and status='payment_cancelled'",
          [expired],
        )
      ).rows[0].n,
      1,
    );
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: other }),
    ]);
    assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n, 0);
    assert.equal(
      (await db.query('select count(*)::int n from public.olist_products')).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query('select tax_document from public.olist_orders'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select public.claim_olist_sync(gen_random_uuid())'),
      /permission denied/,
    );
    await db.exec('reset role; set role service_role');
    assert.equal(
      (await db.query('select public.claim_olist_sync(gen_random_uuid()) claimed')).rows[0].claimed,
      true,
    );
    assert.equal(
      (await db.query('select public.claim_olist_sync(gen_random_uuid()) claimed')).rows[0].claimed,
      false,
    );
    const importedDoc = {
      ...document,
      name: 'ERP draft',
      slug: 'erp-draft',
      status: 'draft',
      source: 'olist',
      externalId: '456',
      colors: [
        {
          ...document.colors[0],
          skus: [{ ...document.colors[0].skus[0], code: 'ERP-P', stock: 0 }],
        },
      ],
    };
    const importedArgs = [
      '456',
      JSON.stringify(importedDoc),
      JSON.stringify([{ sku: 'ERP-P', remote_id: '457' }]),
      'hash',
    ];
    const imported = (
      await db.query('select public.import_olist_product($1,$2,$3,$4) id', importedArgs)
    ).rows[0].id;
    assert.equal(
      (await db.query('select public.import_olist_product($1,$2,$3,$4) id', importedArgs)).rows[0]
        .id,
      imported,
    );
    assert.equal(
      (await db.query('select state from public.olist_products where product_id=$1', [imported]))
        .rows[0].state,
      'linked',
    );
    await db.exec('reset role');
    assert.equal(
      (
        await db.query('select count(*)::int n from public.catalog_products where id=$1', [
          imported,
        ])
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("select stock from private.product_skus where code='ERP-P'")).rows[0].stock,
      0,
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: uid }),
    ]);
    await db.exec('set role authenticated');
    const makeKitProduct = async (code, stock, components) => {
      const doc = {
        ...document,
        name: code,
        slug: code.toLowerCase(),
        colors: [
          {
            ...document.colors[0],
            skus: [
              { ...document.colors[0].skus[0], code, stock, ...(components ? { components } : {}) },
            ],
          },
        ],
      };
      const pub = {
        ...product,
        title: code,
        variants: [{ ...product.variants[0], sku: code, stock }],
      };
      return (
        await db.query('select public.save_product(null,0,$1,$2,null) id', [
          JSON.stringify(doc),
          JSON.stringify({ regular: pub, promotion: pub, saleStart: '', saleEnd: '' }),
        ])
      ).rows[0].id;
    };
    const top = await makeKitProduct('KIT-TOP-P', 7);
    await makeKitProduct('KIT-SHORT-P', 10);
    const kit = await makeKitProduct('KIT-SET-P', 99, [
      { sku: 'KIT-TOP-P', quantity: 1 },
      { sku: 'KIT-SHORT-P', quantity: 1 },
    ]);
    await db.exec('set role service_role');
    const balances = async () =>
      (
        await db.query(
          "select code,stock from private.product_skus where code like 'KIT-%' order by code",
        )
      ).rows;
    assert.deepEqual(await balances(), [
      { code: 'KIT-SET-P', stock: 7 },
      { code: 'KIT-SHORT-P', stock: 10 },
      { code: 'KIT-TOP-P', stock: 7 },
    ]);
    const kitCheckout = async (lines, key) => {
      const q = (
        await db.query(
          "insert into public.checkout_shipping_quotes(user_id,context_hash,products,options) values($1,'kit',$2,$3) returning id",
          [
            uid,
            JSON.stringify(lines),
            JSON.stringify([{ id: 'me:1', name: 'PAC', price: 20, deliveryEstimate: '5 dias' }]),
          ],
        )
      ).rows[0].id;
      return create(
        {
          ...request,
          key,
          quoteId: q,
          payment: 'card',
          items: lines.map((l) => ({ id: l.id, color: l.color, size: l.size, qty: l.qty })),
          expectedTotal: lines.reduce((n, l) => n + l.qty * l.price_cents, 2000),
        },
        key,
      );
    };
    const { randomUUID } = require('node:crypto');
    await assert.rejects(
      kitCheckout(
        [
          { ...quoted, id: top, sku: 'KIT-TOP-P', qty: 1 },
          { ...quoted, id: kit, sku: 'KIT-SET-P', qty: 7 },
        ],
        randomUUID(),
      ),
      /Stock|Total|unavailable/,
    );
    assert.equal(
      (await balances())[2].stock,
      7,
      'mixed basket failure rolls back the top reservation',
    );
    const kitOrder = (
      await kitCheckout([{ ...quoted, id: kit, sku: 'KIT-SET-P', qty: 2 }], randomUUID())
    ).rows[0].id;
    assert.deepEqual(await balances(), [
      { code: 'KIT-SET-P', stock: 5 },
      { code: 'KIT-SHORT-P', stock: 8 },
      { code: 'KIT-TOP-P', stock: 5 },
    ]);
    await db.query("select public.apply_checkout_payment($1,'kit-payment','cancelled',now())", [
      kitOrder,
    ]);
    await db.query(
      "select public.apply_checkout_payment($1,'kit-payment','cancelled',now()+interval '1 second')",
      [kitOrder],
    );
    assert.deepEqual(await balances(), [
      { code: 'KIT-SET-P', stock: 7 },
      { code: 'KIT-SHORT-P', stock: 10 },
      { code: 'KIT-TOP-P', stock: 7 },
    ]);
    await db.query('select private.adjust_checkout_stock($1,$2,-3)', [top, 'KIT-TOP-P']);
    assert.equal((await balances())[0].stock, 4, 'standalone top sale reduces kit availability');
    assert.equal(
      (
        await db.query(
          "select (payload->'regular'->'variants'->0->>'stock')::int stock from public.catalog_products where id=$1",
          [kit],
        )
      ).rows[0].stock,
      4,
    );
    // ERP snapshots are absolute; replaying one must never add/subtract stock again.
    const short = (
      await db.query("select product_id from private.product_skus where code='KIT-SHORT-P'")
    ).rows[0].product_id;
    await db.query("select public.link_olist_sku($1,'KIT-TOP-P','8001','hash')", [top]);
    await db.query("select public.link_olist_sku($1,'KIT-SHORT-P','8002','hash')", [short]);
    await db.exec(
      "insert into public.olist_inventory(sku,enabled) values('KIT-TOP-P',true),('KIT-SHORT-P',true)",
    );
    let tick = Date.now();
    const snapshot = (
      sku,
      erp,
      physical,
      reserved = 0,
      at = new Date((tick += 10)).toISOString(),
    ) =>
      db.query('select public.apply_olist_inventory($1,$2,$3,$4,$5) result', [
        sku,
        erp,
        physical,
        reserved,
        at,
      ]);
    await snapshot('KIT-TOP-P', '8001', 7);
    await snapshot('KIT-SHORT-P', '8002', 10);
    assert.equal((await balances())[0].stock, 7);
    const reservedOrder = (
      await kitCheckout([{ ...quoted, id: kit, sku: 'KIT-SET-P', qty: 2 }], randomUUID())
    ).rows[0].id;
    await snapshot('KIT-TOP-P', '8001', 7);
    await snapshot('KIT-SHORT-P', '8002', 10);
    assert.deepEqual(
      (await balances()).map((r) => r.stock),
      [5, 8, 5],
      'open local reservations survive repeated snapshots',
    );
    const latest = new Date(tick).toISOString();
    assert.equal(
      (await snapshot('KIT-TOP-P', '8001', 999, 0, new Date(tick - 1000).toISOString())).rows[0]
        .result,
      'stale',
    );
    assert.equal((await balances())[2].stock, 5);
    await db.query("select public.apply_checkout_payment($1,'stock-cancel','cancelled',now())", [
      reservedOrder,
    ]);
    await db.query(
      "select public.apply_checkout_payment($1,'stock-cancel','cancelled',now()+interval '1 second')",
      [reservedOrder],
    );
    assert.deepEqual(
      (await balances()).map((r) => r.stock),
      [7, 10, 7],
    );
    await snapshot('KIT-TOP-P', '8001', 6, 1);
    assert.equal(
      (await balances())[0].stock,
      5,
      'external reserved stock reduces kit availability',
    );
    await snapshot('KIT-TOP-P', '8001', 1);
    const lastUnit = (
      await kitCheckout([{ ...quoted, id: top, sku: 'KIT-TOP-P', qty: 1 }], randomUUID())
    ).rows[0].id;
    await assert.rejects(
      kitCheckout([{ ...quoted, id: top, sku: 'KIT-TOP-P', qty: 1 }], randomUUID()),
      /Total|Stock|unavailable/,
    );
    await db.exec(
      "update public.olist_inventory set observed_at=now()-interval '11 minutes' where sku='KIT-TOP-P'",
    );
    await assert.rejects(
      kitCheckout([{ ...quoted, id: kit, sku: 'KIT-SET-P', qty: 1 }], randomUUID()),
      /synchronization/,
    );
    await snapshot('KIT-TOP-P', '8001', 3);
    await db.query(
      "update public.orders set payment_test_mode=false,payment_status='approved' where id=$1",
      [lastUnit],
    );
    await db.query(
      "insert into public.olist_orders(order_id,state,remote_id,attempted_at) values($1,'linked','9001',now()) on conflict(order_id) do update set state='linked',remote_id='9001',attempted_at=now()",
      [lastUnit],
    );
    assert.equal((await snapshot('KIT-TOP-P', '8001', 2)).rows[0].result, 'review');
    assert.equal(
      (await balances())[2].stock,
      2,
      'ambiguous ERP movement never subtracts the hold again',
    );
    await assert.rejects(
      kitCheckout([{ ...quoted, id: top, sku: 'KIT-TOP-P', qty: 1 }], randomUUID()),
      /synchronization/,
    );
    await db.query(
      "select public.confirm_olist_inventory($1,'Movimento ERP 9001 conferido no estoque')",
      [lastUnit],
    );
    await snapshot('KIT-TOP-P', '8001', 2);
    assert.equal(
      (await balances())[2].stock,
      2,
      'confirmed movement releases shadow reservation without adding stock',
    );
    assert.equal((await snapshot('KIT-TOP-P', '8001', 99, 0, latest)).rows[0].result, 'stale');
    await assert.rejects(snapshot('KIT-TOP-P', 'wrong-id', 2), /identity/);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.olist_inventory'), /permission/);
    await assert.rejects(
      db.query("select public.apply_olist_inventory('KIT-TOP-P','8001',9,0,now())"),
      /permission/,
    );
  } finally {
    await db.close();
  }
});
