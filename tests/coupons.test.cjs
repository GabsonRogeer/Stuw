const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const compiled = new Module(filename);
  compiled.require = (name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error('Unexpected dependency: ' + name);
  };
  compiled._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );
  return compiled.exports;
}
const coupons = load('src/services/coupons.ts');
const commerce = load('src/lib/commerce.ts');
const now = Date.parse('2026-09-28T12:00:00Z');
function form(patch = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    code: ' bemvinda10 ',
    percent: '10',
    max_uses: '50',
    expires_on: '2026-09-30',
    active: 'on',
    ...patch,
  }))
    data.set(key, value);
  return data;
}
test('coupon validation normalizes codes and expires at the end of the Brasilia date', () => {
  const { value, error } = coupons.parseCoupon(form(), now);
  assert.equal(error, undefined);
  assert.equal(value.code, 'BEMVINDA10');
  assert.equal(value.expires_at, '2026-10-01T02:59:59.999Z');
  assert.equal(coupons.couponDateInput(value.expires_at), '2026-09-30');
  for (const patch of [
    { code: 'ab' },
    { percent: '0' },
    { percent: '101' },
    { percent: 'NaN' },
    { percent: '1.001' },
    { max_uses: '-1' },
    { max_uses: '' },
    { max_uses: '1.5' },
    { expires_on: '2026-02-30' },
    { expires_on: '2026-09-27' },
  ])
    assert.ok(coupons.parseCoupon(form(patch), now).error);
});

test('zero means unlimited but still respects expiry and activation', () => {
  assert.equal(coupons.parseCoupon(form({ max_uses: '0' }), now).value.max_uses, 0);
  const missing = form();
  missing.delete('max_uses');
  assert.ok(coupons.parseCoupon(missing, now).error);
  const coupon = { active: true, expires_at: '2026-09-28T12:00:01Z', used_count: 500, max_uses: 0 };
  assert.equal(coupons.couponStatus(coupon, now), 'active');
  assert.equal(coupons.couponStatus({ ...coupon, active: false }, now), 'inactive');
  assert.equal(coupons.couponStatus(coupon, now + 1000), 'expired');
});
test('availability distinguishes inactive, expired and exhausted codes with exact boundaries', () => {
  const coupon = { active: true, expires_at: '2026-09-28T12:00:01Z', used_count: 1, max_uses: 2 };
  assert.equal(coupons.couponStatus(coupon, now), 'active');
  assert.equal(coupons.couponStatus({ ...coupon, active: false }, now), 'inactive');
  assert.equal(coupons.couponStatus(coupon, now + 1000), 'expired');
  assert.equal(coupons.couponStatus({ ...coupon, used_count: 2 }, now), 'exhausted');
});
test('managed coupons discount products, shipping and wrapping without negative totals', () => {
  const items = [{ price: 100, qty: 1 }];
  const coupon = { code: 'TOTAL10', percent: 10, expires_at: '2099-01-01T00:00:00Z' };
  const total = commerce.calculateTotals(items, coupon, 'pix', true, 20);
  assert.equal(total.discount, 15.5);
  assert.equal(total.pixDiscount, 4.5);
  assert.equal(total.total, 135);
  assert.equal(
    commerce.calculateTotals(items, { ...coupon, percent: 100 }, 'pix', true, 20).total,
    0,
  );
  assert.equal(commerce.calculateTotals([], coupon, 'pix', true, 20).total, 0);
});
function actions(client, allowed = true) {
  return load('src/app/admin/cupons/actions.ts', {
    '@/services/coupons': coupons,
    '@/lib/supabase/admin': {
      requireAdmin: async () => {
        if (!allowed) throw new Error('Denied');
        return { supabase: client };
      },
    },
    'next/cache': { revalidatePath: () => {} },
  });
}
test('coupon mutations fail closed before accessing the database for unauthorized callers', async () => {
  const api = actions({ from: () => assert.fail('Unauthorized database access') }, false);
  assert.ok((await api.saveCoupon({}, form())).error);
  assert.ok((await api.toggleCoupon({}, form())).error);
});
test('administrator cannot overwrite usage counters through crafted form fields', async () => {
  let saved;
  const query = {
    select: () => query,
    maybeSingle: async () => ({ data: { id: 'new' }, error: null }),
  };
  const api = actions({
    from: () => ({
      insert: (value) => {
        saved = value;
        return query;
      },
    }),
  });
  const result = await api.saveCoupon(
    {},
    form({ expires_on: '2099-01-01', used_count: '999', id: '' }),
  );
  assert.ok(result.message);
  assert.equal(saved.used_count, undefined);
  assert.equal(saved.code, 'BEMVINDA10');
});
test('duplicate coupon codes return an actionable error rather than success', async () => {
  const query = {
    select: () => query,
    maybeSingle: async () => ({ data: null, error: { code: '23505' } }),
  };
  const api = actions({ from: () => ({ insert: () => query }) });
  assert.match((await api.saveCoupon({}, form({ expires_on: '2099-01-01' }))).error, /Já existe/);
});
test('reactivation refuses expired or exhausted coupons', async () => {
  for (const record of [
    { expires_at: '2000-01-01', used_count: 0, max_uses: 5 },
    { expires_at: '2000-01-01', used_count: 10, max_uses: 0 },
    { expires_at: '2099-01-01', used_count: 5, max_uses: 5 },
  ]) {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: record, error: null }),
      update: () => assert.fail('Should not reactivate'),
    };
    const api = actions({ from: () => query });
    assert.match(
      (await api.toggleCoupon({}, form({ id: 'id', active: 'true' }))).error,
      /Edite a validade/,
    );
  }
});

test('unlimited coupons with previous uses can be reactivated', async () => {
  let updated = false;
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({
      data: { id: 'id', expires_at: '2099-01-01', used_count: 50, max_uses: 0 },
    }),
    update: () => {
      updated = true;
      return query;
    },
  };
  const result = await actions({ from: () => query }).toggleCoupon(
    {},
    form({ id: 'id', active: 'true' }),
  );
  assert.ok(result.message);
  assert.equal(updated, true);
});
