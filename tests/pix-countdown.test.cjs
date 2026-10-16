const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const { pixCountdown } = loadTypeScript('src/services/pix-countdown.ts');

test('Pix cycles use the persisted deadline, respect provider margins and never renew on a boundary', () => {
  const end = Date.parse('2026-10-16T15:30:00Z');
  const at = (seconds) => pixCountdown(new Date(end).toISOString(), end - seconds * 1000);
  assert.deepEqual(at(1800).segments, [1, 1, 1]);
  assert.equal(at(1800).label, '30:00');
  assert.equal(at(1800).cycleLabel, '10:00');
  assert.equal(at(1201).cycle, 1);
  assert.equal(at(1200).cycle, 2);
  assert.equal(at(1200).label, '20:00');
  assert.equal(at(1200).cycleLabel, '10:00');
  assert.deepEqual(at(900).segments, [0, 0.5, 1]);
  assert.equal(at(600).cycle, 3);
  assert.equal(at(600).label, '10:00');
  assert.equal(at(0).remaining, 0);
  assert.equal(at(-10).label, '00:00');
  assert.equal(at(2100).label, '35:00');
  assert.equal(at(2100).inCycles, false);
  assert.equal(pixCountdown('invalid', end), null);
});
