const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, deps = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const compiledModule = new Module(filename);
  compiledModule.require = (name) => {
    if (name in deps) return deps[name];
    throw new Error(name);
  };
  compiledModule._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );
  return compiledModule.exports;
}
const checkout = load('src/services/checkout.ts');
const profile = load('src/services/checkout-profile.ts', { './checkout': checkout });
const address = {
  id: 'one',
  label: 'Casa',
  recipient: 'Maria da Silva',
  postal_code: '01001000',
  street: 'Rua A',
  number: '10',
  complement: 'Ap 1',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
};
test('prefill uses account contact and the saved delivery recipient, without opting into marketing', () => {
  const value = profile.initialCheckoutInformation(
    'account@example.com',
    { full_name: 'João Santos', phone: '11999999999' },
    address,
  );
  assert.equal(value.firstName, 'Maria');
  assert.equal(value.lastName, 'da Silva');
  assert.equal(value.email, 'account@example.com');
  assert.equal(value.phone, '11999999999');
  assert.equal(value.postalCode, '01001000');
  assert.equal(value.emailOffers, false);
  assert.equal(value.whatsappOffers, false);
  assert.equal(checkout.isInformationValid(value), true);
});
test('missing profile and address leave fields editable; a single name does not invent a surname', () => {
  const empty = profile.initialCheckoutInformation('a@example.com', null, null);
  assert.equal(empty.street, '');
  assert.equal(empty.phone, '');
  const one = profile.initialCheckoutInformation(
    'a@example.com',
    { full_name: '  Ana  ', phone: null },
    null,
  );
  assert.equal(one.firstName, 'Ana');
  assert.equal(one.lastName, '');
});
test('switching addresses clears stale optional values and shipping context, preserving contact', () => {
  const original = {
    ...profile.initialCheckoutInformation(
      'a@example.com',
      { full_name: 'João Santos', phone: '11999999999' },
      address,
    ),
    emailOffers: true,
  };
  const changed = profile.applyCheckoutAddress(
    original,
    { ...address, number: '20', complement: '' },
    'João Santos',
  );
  assert.equal(changed.complement, '');
  assert.equal(changed.phone, original.phone);
  assert.equal(changed.emailOffers, true);
  assert.notEqual(
    checkout.shippingContextKey(original, []),
    checkout.shippingContextKey(changed, []),
  );
  const fresh = profile.applyCheckoutAddress(changed, null, 'João Santos');
  assert.equal(fresh.street, '');
  assert.equal(fresh.postalCode, '');
  assert.equal(fresh.firstName, 'João');
  assert.equal(original.number, '10');
});
test('profile loader scopes both queries to the authenticated account and handles partial failures', async () => {
  const calls = [];
  const api = load('src/lib/supabase/checkout-profile.ts', { 'server-only': {} });
  const client = {
    from(table) {
      const query = {
        select() {
          return query;
        },
        eq(column, id) {
          calls.push([table, column, id]);
          return query;
        },
        order() {
          return query;
        },
        maybeSingle: async () => ({ data: null, error: { code: 'unavailable' } }),
        then(resolve) {
          return Promise.resolve({ data: [address], error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  const result = await api.loadCheckoutProfile(client, 'session-user');
  assert.deepEqual(calls, [
    ['profiles', 'id', 'session-user'],
    ['addresses', 'user_id', 'session-user'],
  ]);
  assert.equal(result.loadError, true);
  assert.equal(result.profile, null);
  assert.deepEqual(result.addresses, [address]);
});
