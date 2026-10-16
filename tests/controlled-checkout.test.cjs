const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const { assertControlledCheckout } = loadTypeScript('src/services/controlled-checkout.ts');
test('controlled products fail closed for other buyers without restricting regular products', (t) => {
  const fields = ['CONTROLLED_PRODUCT_IDS', 'CONTROLLED_BUYER_IDS'];
  const original = Object.fromEntries(fields.map((key) => [key, process.env[key]]));
  t.after(() =>
    fields.forEach((key) => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }),
  );
  process.env.CONTROLLED_PRODUCT_IDS = '1000021';
  delete process.env.CONTROLLED_BUYER_IDS;
  assert.throws(() => assertControlledCheckout('buyer', [{ id: 1000021 }]), /reservado/);
  assert.doesNotThrow(() => assertControlledCheckout('buyer', [{ id: 1 }]));
  process.env.CONTROLLED_BUYER_IDS = 'buyer';
  assert.doesNotThrow(() => assertControlledCheckout('buyer', [{ id: 1000021 }]));
  assert.throws(() => assertControlledCheckout('other', [{ id: 1 }, { id: 1000021 }]), /reservado/);
  process.env.CONTROLLED_PRODUCT_IDS = 'invalid';
  assert.throws(() => assertControlledCheckout('buyer', [{ id: 1000021 }]), /Configuração/);
  delete process.env.CONTROLLED_PRODUCT_IDS;
  assert.doesNotThrow(() => assertControlledCheckout('other', [{ id: 1000021 }]));
});
