const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const { parseOlistStock } = loadTypeScript('src/lib/integrations/olist-inventory.ts', {
  'server-only': {},
});
test('ERP inventory validates identity and integer balances, with optional reservation extension', () => {
  const p = { id: 123, codigo: 'STUW-P', saldo: '7.00', saldoReservado: '2' };
  assert.deepEqual(parseOlistStock(p, '123', 'STUW-P'), { physical: 7, reserved: 2 });
  assert.deepEqual(
    parseOlistStock({ ...p, saldo: -2, saldoReservado: undefined }, '123', 'STUW-P'),
    { physical: -2, reserved: 0 },
  );
  for (const patch of [
    { id: 456 },
    { codigo: 'OTHER' },
    { saldo: null },
    { saldo: '' },
    { saldo: 1.5 },
    { saldo: 'NaN' },
    { saldoReservado: -1 },
  ])
    assert.throws(() => parseOlistStock({ ...p, ...patch }, '123', 'STUW-P'));
});
