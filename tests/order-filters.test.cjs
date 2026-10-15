const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const { orderFilters } = loadTypeScript('src/services/order-filters.ts');

test('order search preserves customer accents, email and short codes while excluding filter operators', () => {
  for (const q of ['José da Silva', 'cliente@example.com', 'STUW-1NJCHS']) {
    assert.equal(orderFilters({ q: ` ${q} ` }).q, q);
  }
  const filtered = orderFilters({
    q: 'cliente%,status.eq.paid_(x)',
    status: 'unknown',
    mode: 'unknown',
  });
  assert.doesNotMatch(filtered.q, /[%,()_]/);
  assert.equal(filtered.status, '');
  assert.equal(filtered.mode, '');
  assert.equal(orderFilters({ q: 'a'.repeat(200) }).q.length, 100);
});
test('order filters preserve combined status and live/sandbox/demo selection', () => {
  for (const mode of ['live', 'sandbox', 'demo']) {
    assert.deepEqual(orderFilters({ q: 'STUW-1NJCHS', status: 'paid', mode }), {
      q: 'STUW-1NJCHS',
      status: 'paid',
      mode,
    });
  }
});
