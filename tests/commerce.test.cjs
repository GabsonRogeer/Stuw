const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Test the real pure TypeScript modules without introducing a second test framework.
function load(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const compiledModule = new Module(filename);
  compiledModule._compile(compiled.outputText, filename);
  return compiledModule.exports;
}
const { addCartItem, calculateTotals, restoreCart, itemKey } = load('src/lib/commerce.ts');
const { queryCatalog } = load('src/services/catalog.ts');
const { PRODUCTS } = load('src/data/products.ts');
const product = PRODUCTS[0];
const cart = (product = PRODUCTS[0]) =>
  addCartItem([], product, product.sizes[0], product.colors[0].name);

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
