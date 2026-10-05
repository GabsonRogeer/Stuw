const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, deps = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const m = new Module(filename);
  m.require = (name) => {
    if (name in deps) return deps[name];
    throw new Error(name);
  };
  m._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return m.exports;
}
const admin = load('src/services/product-admin.ts', {
  '@/data/navigation': load('src/data/navigation.ts'),
});
const commerce = load('src/lib/commerce.ts');
const { PRODUCTS } = load('src/data/products.ts');
const repository = load('src/repositories/products.ts', {
  '@/data/products': { PRODUCTS },
  '@/lib/supabase/config': {},
});
test('all existing products can be prepared as drafts without changing their IDs or media', () => {
  for (const p of PRODUCTS) assert.equal(admin.validateProduct(admin.fromLegacy(p)), null, p.slug);
});
function draft() {
  return {
    ...admin.emptyProduct(),
    name: 'STUW Sculpt',
    slug: 'stuw-sculpt',
    description: 'Descrição',
    brand: 'STUW',
    category: 'Conjuntos',
    activityCategory: 'Activewear / Training',
    price: 100,
    status: 'active',
    sizes: ['P', 'M'],
    colors: [
      {
        name: 'Mocha',
        slug: 'mocha',
        hex: '#8B6B55',
        swatch: '',
        active: true,
        price: null,
        images: [{ src: '/products/sculpt/frente.webp', alt: 'Frente Mocha', role: 'frente' }],
        skus: [
          { size: 'P', code: 'SCULPT-MOCHA-P', gtin: '', stock: 2, price: null, active: true },
          { size: 'M', code: 'SCULPT-MOCHA-M', gtin: '', stock: 0, price: 150, active: true },
        ],
      },
    ],
  };
}
test('draft and publishing validations cover hierarchy, money, composition, GTIN and media', () => {
  assert.equal(
    admin.validateProduct({ ...admin.emptyProduct(), name: 'Novo', slug: 'novo' }),
    null,
  );
  assert.equal(admin.validateProduct(draft()), null);
  for (const patch of [
    { slug: '../invalid' },
    { price: NaN },
    { price: 1.234 },
    { comparePrice: 90 },
    { description: '' },
    { sizes: ['P', 'P'] },
    { salePrice: 101 },
    { composition: 'Poliamida: 90; Elastano: 20' },
    { ncm: '123' },
    { canonical: 'https://evil.example' },
  ])
    assert.ok(admin.validateProduct({ ...draft(), ...patch }), JSON.stringify(patch));
  const p = draft();
  p.colors[0].skus[1].size = 'P';
  assert.ok(admin.validateProduct(p));
  assert.equal(admin.validGtin('7894900011517'), true);
  assert.equal(admin.validGtin('7894900011518'), false);
  assert.equal(admin.validAsset('https://evil.example/image.svg'), false);
  assert.equal(admin.validAsset('/products/../secrets.png'), false);
});
test('SKU prices override color and promotion, absent combinations and stock cannot enter cart', () => {
  const d = draft();
  d.colors[0].price = 120;
  d.salePrice = 80;
  d.saleStart = '2026-10-01T00:00:00Z';
  d.saleEnd = '2026-11-01T00:00:00Z';
  const p = admin.toStoreProduct(1000000, d, Date.parse('2026-10-05T00:00:00Z'));
  assert.equal(p.variants[0].price, 120);
  assert.equal(p.variants[1].price, 150);
  assert.deepEqual(commerce.addCartItem([], p, 'M', 'Mocha'), []);
  assert.deepEqual(commerce.addCartItem([], p, 'P', 'Preto'), []);
  let cart = commerce.addCartItem([], p, 'P', 'Mocha');
  cart = commerce.addCartItem(cart, p, 'P', 'Mocha');
  cart = commerce.addCartItem(cart, p, 'P', 'Mocha');
  assert.equal(cart[0].qty, 2);
  assert.equal(cart[0].price, 120);
  assert.equal(commerce.restoreCart([{ ...cart[0], price: 1, qty: 99 }], [p])[0].price, 120);
  d.colors[0].price = null;
  assert.equal(admin.toStoreProduct(1, d, Date.parse(d.saleStart)).variants[0].price, 80);
  assert.equal(admin.toStoreProduct(1, d, Date.parse(d.saleEnd)).variants[0].price, 100);
});
test('public projection excludes cost, tax, integration and actor information', () => {
  const d = { ...draft(), cost: 30, externalId: 'ERP-secret', ncm: '12345678' };
  const p = admin.toStoreProduct(1, d);
  for (const key of ['cost', 'ncm', 'externalId', 'source', 'lastSync', 'created_by'])
    assert.equal(p[key], undefined);
});
test('managed inactive and scheduled legacy products do not reappear through the static fallback', () => {
  const original = PRODUCTS[0];
  assert.equal(
    repository
      .mergeCatalog([{ id: original.id, payload: null, publish_at: null, aliases: [] }])
      .some((p) => p.id === original.id),
    false,
  );
  const p = admin.toStoreProduct(original.id, draft());
  const row = {
    id: original.id,
    payload: {
      regular: p,
      promotion: { ...p, price: 80 },
      saleStart: '2026-10-02T00:00:00Z',
      saleEnd: '2026-10-03T00:00:00Z',
    },
    publish_at: '2026-10-01T00:00:00Z',
    aliases: [],
  };
  assert.equal(
    repository
      .mergeCatalog([row], Date.parse('2026-09-30T00:00:00Z'))
      .some((p) => p.id === original.id),
    false,
  );
  assert.equal(
    repository
      .mergeCatalog([row], Date.parse('2026-10-02T00:00:00Z'))
      .find((p) => p.id === original.id).price,
    80,
  );
  assert.equal(
    repository
      .mergeCatalog([row], Date.parse('2026-10-03T00:00:00Z'))
      .find((p) => p.id === original.id).price,
    100,
  );
});

test('public route resolution preserves legacy URLs, redirects aliases and hides tombstones', async () => {
  const route = load('src/repositories/product-routes.ts', {
    '@/data/products': { PRODUCTS },
    '@/lib/supabase/config': {
      isSupabaseConfigured: () => true,
      getSupabaseConfig: () => ({ url: 'https://example.invalid', key: 'public' }),
    },
  });
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => new Response('', { status: 404 });
    assert.equal(await route.resolveProductRoute(PRODUCTS[0].slug), PRODUCTS[0].slug);
    assert.equal(await route.resolveProductRoute('nao-existe'), null);
    global.fetch = async () =>
      Response.json([{ id: PRODUCTS[0].id, slug: null, publish_at: null }]);
    assert.equal(await route.resolveProductRoute(PRODUCTS[0].slug), null);
    global.fetch = async () =>
      Response.json([{ id: PRODUCTS[0].id, slug: 'novo-modelo', publish_at: null }]);
    assert.equal(await route.resolveProductRoute(PRODUCTS[0].slug), 'novo-modelo');
    global.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(route.resolveProductRoute(PRODUCTS[0].slug), /indisponível/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('product actions reject unauthorized callers before any database or storage write', async () => {
  const actions = load('src/app/admin/produtos/actions.ts', {
    'next/cache': {},
    '@/lib/supabase/admin': {
      requireAdmin: async () => {
        throw new Error('denied');
      },
    },
    '@/data/products': { PRODUCTS },
    '@/services/product-admin': admin,
    'node:fs/promises': {},
    'node:path': {},
  });
  assert.ok((await actions.saveProduct({ id: null, revision: 0, document: draft() })).error);
  assert.ok((await actions.archiveProduct(1, 1)).error);
});
