const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Test the real pure TypeScript modules without introducing a second test framework.
function load(relativePath, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const compiledModule = new Module(filename);
  const originalRequire = compiledModule.require.bind(compiledModule);
  compiledModule.require = (specifier) =>
    Object.prototype.hasOwnProperty.call(dependencies, specifier)
      ? dependencies[specifier]
      : originalRequire(specifier);
  compiledModule._compile(compiled.outputText, filename);
  return compiledModule.exports;
}
const { addCartItem, calculateTotals, restoreCart, itemKey } = load('src/lib/commerce.ts');
const { queryCatalog } = load('src/services/catalog.ts');
const { PRODUCTS } = load('src/data/products.ts');
const personalization = load('src/services/personalization.ts');
const { recommendProducts, recommendFromHistory, getComplementaryProduct } = load(
  'src/services/recommendations.ts',
);
const product = PRODUCTS[0];
const checkout = load('src/services/checkout.ts');
const { quoteShipping } = load('src/services/shipping.ts', {
  '@/lib/commerce': load('src/lib/commerce.ts'),
});
const cart = (product = PRODUCTS[0]) =>
  addCartItem([], product, product.sizes[0], product.colors[0].name);

test('checkout validates information and prevents skipping required stages', () => {
  assert.equal(checkout.isInformationValid(checkout.EMPTY_INFORMATION), false);
  assert.equal(checkout.isInformationValid(checkout.DEMO_INFORMATION), true);
  for (const patch of [
    { email: 'invalid' },
    { postalCode: '12' },
    { phone: '123' },
    { state: 'XX' },
    { street: '   ' },
  ]) {
    assert.equal(checkout.isInformationValid({ ...checkout.DEMO_INFORMATION, ...patch }), false);
  }
  assert.equal(checkout.checkoutRedirect('information', false, false), null);
  assert.equal(checkout.checkoutRedirect('shipping', false, false), '/checkout/information');
  assert.equal(checkout.checkoutRedirect('payment', true, false), '/checkout/shipping');
  assert.equal(checkout.checkoutRedirect('payment', true, true), null);
});

test('shipping selection becomes stale after address or basket changes, not contact edits', () => {
  const items = cart();
  const key = checkout.shippingContextKey(checkout.DEMO_INFORMATION, items);
  assert.notEqual(
    checkout.shippingContextKey({ ...checkout.DEMO_INFORMATION, postalCode: '20000-000' }, items),
    key,
  );
  assert.notEqual(
    checkout.shippingContextKey({ ...checkout.DEMO_INFORMATION, number: '200' }, items),
    key,
  );
  assert.notEqual(
    checkout.shippingContextKey(checkout.DEMO_INFORMATION, [{ ...items[0], qty: 2 }]),
    key,
  );
  assert.equal(
    checkout.shippingContextKey(
      { ...checkout.DEMO_INFORMATION, email: 'another@example.com' },
      items,
    ),
    key,
  );
});

test('selected freight, gift wrap, coupons and payment compose consistent totals', () => {
  assert.deepEqual(quoteShipping({ postalCode: 'bad', subtotal: 480 }), []);
  assert.deepEqual(quoteShipping({ postalCode: '01001-000', subtotal: 0 }), []);
  const options = quoteShipping({ postalCode: '01001-000', subtotal: 480 });
  assert.deepEqual(
    options.map((option) => option.price),
    [28, 45],
  );
  assert.deepEqual(
    quoteShipping({ postalCode: '01001-000', subtotal: 499 }).map((option) => option.price),
    [0, 45],
  );
  assert.equal(calculateTotals(cart(), 'PRIVE10', 'pix', true, options[1].price).total, 490.4);
  assert.equal(calculateTotals(cart(), 'PRIVE10', 'card', false, options[1].price).total, 477);
  assert.equal(calculateTotals(cart(), '', null, false, 0).shipping, 0);
  assert.equal(calculateTotals([], '', 'pix', true, 45).total, 0);
});

test('tax document validates CPF, numeric CNPJ and the official alphanumeric CNPJ example', () => {
  for (const document of ['529.982.247-25', '11.222.333/0001-81', '12.ABC.345/01DE-35']) {
    assert.equal(checkout.isTaxDocumentValid(document), true, document);
  }
  for (const document of [
    '',
    '11111111111',
    '00000000000000',
    '52998224724',
    '11222333000182',
    '12.ABC.345/01DE-34',
    '12ABC34501DE3A',
  ]) {
    assert.equal(checkout.isTaxDocumentValid(document), false, document);
  }
});

test('browsing history requires explicit, unexpired consent', () => {
  const now = Date.now();
  for (const choice of [null, 'rejected']) {
    const state = { version: 1, choice, chosenAt: now, views: [] };
    assert.equal(personalization.recordProductView(state, 7, now), state);
  }
  const expired = {
    version: 1,
    choice: 'accepted',
    chosenAt: now - personalization.CONSENT_TTL,
    views: [],
  };
  assert.equal(personalization.recordProductView(expired, 7, now), expired);
  assert.deepEqual(
    personalization.parsePersonalization(JSON.stringify(expired), now),
    personalization.emptyPersonalization(),
  );
});

test('history validates storage, expires visits, deduplicates and caps at 20', () => {
  const now = Date.now();
  let state = { version: 1, choice: 'accepted', chosenAt: now, views: [] };
  for (let id = 1; id <= 25; id++) state = personalization.recordProductView(state, id, now + id);
  state = personalization.recordProductView(state, 10, now + 26);
  assert.equal(state.views.length, 20);
  assert.equal(state.views[0].productId, 10);
  assert.equal(new Set(state.views.map((view) => view.productId)).size, 20);
  const raw = JSON.stringify({
    ...state,
    views: [
      null,
      {},
      { productId: -1, viewedAt: now },
      { productId: 1, viewedAt: now - personalization.HISTORY_TTL },
      { productId: 2, viewedAt: now + 1000 },
      { productId: 3, viewedAt: now - 2 },
      { productId: 3, viewedAt: now - 1 },
    ],
  });
  assert.deepEqual(personalization.parsePersonalization(raw, now).views, [
    { productId: 3, viewedAt: now - 1 },
  ]);
  assert.deepEqual(
    personalization.parsePersonalization('{broken', now),
    personalization.emptyPersonalization(),
  );
  assert.deepEqual(
    personalization.parsePersonalization(JSON.stringify({ ...state, choice: 'rejected' }), now)
      .views,
    [],
  );
});

test('recommendations rank matching products without mutating catalog or suggesting exclusions', () => {
  const before = JSON.stringify(PRODUCTS);
  const suggestions = recommendProducts(PRODUCTS, [7], [1], 4);
  assert.equal(suggestions[0].category, 'Conjuntos');
  assert.equal(suggestions[0].fabric, 'SculptHold');
  assert.ok(suggestions.every((product) => product.id !== 7 && product.id !== 1));
  assert.deepEqual(recommendProducts(PRODUCTS, []), []);
  assert.deepEqual(recommendProducts(PRODUCTS, [-1]), []);
  assert.equal(JSON.stringify(PRODUCTS), before);
  assert.equal(getComplementaryProduct(PRODUCTS, PRODUCTS[0]).category, 'Tops & Sutiãs');
});

test('browser repository records nothing before consent, revokes history, handles other tabs and blocked storage', (t) => {
  const previousWindow = global.window;
  t.after(() => {
    global.window = previousWindow;
  });
  const entries = new Map();
  const listeners = new Map();
  let blocked = false;
  global.window = {
    localStorage: {
      getItem(key) {
        if (blocked) throw Error('blocked');
        return entries.get(key) ?? null;
      },
      setItem(key, value) {
        if (blocked) throw Error('blocked');
        entries.set(key, value);
      },
    },
    addEventListener(name, fn) {
      listeners.set(name, fn);
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.(event);
    },
  };
  const filename = path.resolve(__dirname, '../src/repositories/personalization.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  function loadRepository() {
    const repositoryModule = new Module(filename);
    repositoryModule.require = () => personalization;
    repositoryModule._compile(compiled.outputText, filename);
    return repositoryModule.exports.personalizationRepository;
  }
  const repository = loadRepository();
  let notifications = 0;
  const unsubscribe = repository.subscribe(() => notifications++);
  repository.record(7);
  assert.equal(entries.size, 0);
  repository.choose('accepted');
  repository.record(7);
  repository.record(8);
  const reloadedRepository = loadRepository();
  assert.equal(JSON.parse(reloadedRepository.readSnapshot()).choice, 'accepted');
  assert.deepEqual(
    JSON.parse(reloadedRepository.readSnapshot()).views.map((view) => view.productId),
    [8, 7],
  );
  reloadedRepository.prune(new Set(PRODUCTS.map((product) => product.id)));
  assert.deepEqual(
    JSON.parse(reloadedRepository.readSnapshot()).views.map((view) => view.productId),
    [8, 7],
  );
  repository.prune(new Set([7]));
  assert.deepEqual(
    JSON.parse(repository.readSnapshot()).views.map((v) => v.productId),
    [7],
  );
  repository.clearHistory();
  assert.deepEqual(JSON.parse(repository.readSnapshot()).views, []);
  repository.record(7);
  repository.choose('rejected');
  repository.record(8);
  assert.deepEqual(JSON.parse(repository.readSnapshot()).views, []);
  repository.choose('accepted');
  const key = [...entries.keys()][0];
  entries.set(
    key,
    JSON.stringify({ version: 1, choice: 'rejected', chosenAt: Date.now(), views: [] }),
  );
  listeners.get('storage')({ key });
  repository.record(7);
  assert.equal(JSON.parse(repository.readSnapshot()).choice, 'rejected');
  assert.deepEqual(JSON.parse(repository.readSnapshot()).views, []);
  blocked = true;
  repository.choose('accepted');
  repository.record(8);
  assert.equal(JSON.parse(repository.readSnapshot()).views[0].productId, 8);
  repository.choose('rejected');
  assert.deepEqual(JSON.parse(repository.readSnapshot()).views, []);
  assert.ok(notifications > 0);
  unsubscribe();
  assert.equal(listeners.size, 0);
});

test('discovery survives viewing the entire catalog and prioritizes unseen products', () => {
  const allViewed = PRODUCTS.map((product) => product.id);
  assert.equal(recommendFromHistory(PRODUCTS, allViewed).length, 4);
  const onProduct = recommendFromHistory(PRODUCTS, allViewed, 7);
  assert.equal(onProduct.length, 4);
  assert.ok(onProduct.every((product) => product.id !== 7));
  const afterOneView = recommendFromHistory(PRODUCTS, [7]);
  assert.equal(afterOneView.length, 4);
  assert.ok(afterOneView.every((product) => product.id !== 7));
  assert.deepEqual(recommendFromHistory(PRODUCTS, []), []);
  assert.ok(recommendFromHistory(PRODUCTS, [], 7).length > 0);
  assert.deepEqual(recommendFromHistory([PRODUCTS[0]], [PRODUCTS[0].id], PRODUCTS[0].id), []);
});

test('variants include color and size; repeated additions increase only the matching variant', () => {
  let items = cart();
  items = addCartItem(items, product, product.sizes[0], product.colors[0].name);
  items = addCartItem(items, product, product.sizes[0], product.colors[1].name);
  items = addCartItem(items, product, product.sizes[1], product.colors[0].name);
  assert.deepEqual(
    items.map((item) => item.qty),
    [2, 1, 1],
  );
  assert.equal(new Set(items.map(itemKey)).size, 3);
});
test('invalid variant cannot enter the cart', () => {
  assert.deepEqual(addCartItem([], product, 'XXXX', product.colors[0].name), []);
  assert.deepEqual(addCartItem([], product, 'P', 'Not a color'), []);
});
test('free shipping boundary, coupons, PIX and gift totals use consistent cents', () => {
  const items = cart();
  assert.deepEqual(calculateTotals(items, 'PRIVE10', 'pix', true), {
    subtotal: 480,
    discount: 48,
    pixDiscount: 21.6,
    shipping: 28,
    giftCost: 35,
    total: 473.4,
  });
  assert.equal(calculateTotals([{ ...items[0], price: 498.99 }]).shipping, 28);
  assert.equal(calculateTotals([{ ...items[0], price: 499 }]).shipping, 0);
  assert.equal(calculateTotals([], 'PRIVE10', 'pix', true).total, 0);
});
test('cart and checkout with no extra options have identical totals', () => {
  assert.equal(
    calculateTotals(cart(), 'PRIVE10').total,
    calculateTotals(cart(), 'PRIVE10', 'card').total,
  );
});
test('restoring storage rejects corrupt, deleted and invalid variants and ignores client prices', () => {
  assert.deepEqual(restoreCart(null, PRODUCTS), []);
  const valid = { ...cart()[0], price: 0.01, qty: 3 };
  const restored = restoreCart(
    [
      null,
      {},
      { ...valid, id: -1 },
      { ...valid, size: 'invalid' },
      { ...valid, qty: -1 },
      { ...valid, qty: 1.2 },
      valid,
    ],
    PRODUCTS,
  );
  assert.equal(restored.length, 1);
  assert.equal(restored[0].price, 480);
  assert.equal(restored[0].qty, 3);
});
test('restoring duplicate variants merges and caps quantity', () => {
  const item = { ...cart()[0], qty: 80 };
  assert.equal(restoreCart([item, item], PRODUCTS)[0].qty, 99);
});
test('slugs are explicit, URL-safe and unique across the catalog', () => {
  assert.equal(new Set(PRODUCTS.map((product) => product.slug)).size, PRODUCTS.length);
  for (const product of PRODUCTS) assert.match(product.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});
test('category, fabric, occasion and accent-insensitive search combine', () => {
  assert.deepEqual(
    queryCatalog(PRODUCTS, {
      categoria: 'Leggings & Calças',
      tecido: 'SculptHold',
      ocasiao: 'Studio & Mindful',
      busca: 'legging',
    }).products.map((product) => product.id),
    [1],
  );
  assert.equal(queryCatalog(PRODUCTS, { busca: 'macacao' }).total, 1);
  assert.equal(
    queryCatalog(PRODUCTS, { tecido: 'SilkAir', categoria: 'Leggings & Calças' }).total,
    0,
  );
});
test('sort does not mutate source, pagination handles invalid and out-of-range input', () => {
  const before = PRODUCTS.map((product) => product.id);
  const result = queryCatalog(PRODUCTS, { ordem: 'menor-preco', pagina: '-2' });
  assert.equal(result.products[0].id, 6);
  assert.equal(result.page, 1);
  assert.deepEqual(
    PRODUCTS.map((product) => product.id),
    before,
  );
  const many = Array.from({ length: 31 }, (_, index) => ({ ...product, id: index + 100 }));
  const last = queryCatalog(many, { pagina: '999' });
  assert.equal(last.page, 3);
  assert.equal(last.products.length, 7);
  assert.equal(queryCatalog(many, { pagina: 'NaN' }).page, 1);
});

test('collection, color and activity filters combine and search includes catalog metadata', () => {
  assert.deepEqual(
    queryCatalog(PRODUCTS, {
      categoria: 'Activewear / Training',
      colecao: 'Move',
      cor: 'Black',
    }).products.map((product) => product.id),
    [10],
  );
  assert.deepEqual(
    queryCatalog(PRODUCTS, { categoria: 'Conjuntos', colecao: 'Run', cor: 'Black' }).products.map(
      (product) => product.id,
    ),
    [12],
  );
  assert.equal(queryCatalog(PRODUCTS, { colecao: 'Move', cor: 'Mocha' }).total, 0);
  assert.ok(
    queryCatalog(PRODUCTS, { busca: 'training' }).products.some((product) => product.id === 10),
  );
  assert.ok(
    queryCatalog(PRODUCTS, { busca: 'off-white' }).products.some((product) => product.id === 11),
  );
});

test('catalog IDs are unique and every gallery image exists with exact filename casing', () => {
  assert.equal(new Set(PRODUCTS.map((product) => product.id)).size, PRODUCTS.length);
  const images = new Set(fs.readdirSync(path.resolve(__dirname, '../public/products')));
  for (const product of PRODUCTS) {
    assert.ok(product.collection && product.activityCategory);
    for (const src of [
      product.image,
      product.hoverImage,
      ...(product.galleryImages ?? []).map((image) => image.src),
    ].filter(Boolean)) {
      assert.ok(
        images.has(src.replace('/products/', '')),
        `Missing or incorrectly cased image: ${src}`,
      );
    }
  }
});
