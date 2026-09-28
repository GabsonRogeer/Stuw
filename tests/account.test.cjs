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
    throw new Error(`Unexpected dependency: ${name}`);
  };
  compiled._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );
  return compiled.exports;
}
const account = load('src/services/account.ts');
const address = {
  label: 'Casa',
  recipient: 'Cliente Teste',
  postal_code: '01001000',
  street: 'Rua A',
  number: '10',
  complement: '',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
};
test('personal data rejects invalid and future dates, accepts leap years and optional fields', () => {
  assert.equal(account.validateProfile('Cliente Teste', '2000-02-29', '11999999999'), null);
  assert.equal(account.validateProfile('Cliente Teste', '', ''), null);
  for (const date of ['2001-02-29', '2020-13-01', '2999-01-01', '1899-01-01', 'abc'])
    assert.ok(account.validateProfile('Cliente Teste', date, ''));
  assert.ok(account.validateProfile(' ', '', ''));
  assert.ok(account.validateProfile('Cliente', '', '123'));
});
test('addresses validate mandatory fields, CEP and UF independently of the browser', () => {
  assert.equal(account.validateAddress(address), null);
  for (const patch of [
    { street: '' },
    { number: '' },
    { postal_code: '01000' },
    { state: 'XX' },
    { complement: 'a'.repeat(201) },
  ])
    assert.ok(account.validateAddress({ ...address, ...patch }));
});
function setup(result = { data: { id: 'address-id' }, error: null }) {
  const calls = [];
  const query = {};
  for (const method of ['update', 'insert', 'delete', 'eq', 'select'])
    query[method] = (...args) => {
      calls.push([method, ...args]);
      return query;
    };
  query.maybeSingle = async () => result;
  const actions = load('src/app/conta/actions.ts', {
    '@/services/account': account,
    '@/lib/supabase/account': {
      requireAccount: async () => ({
        user: { id: 'session-user' },
        supabase: {
          from: (table) => {
            calls.push(['from', table]);
            return query;
          },
        },
      }),
    },
    'next/cache': { revalidatePath: () => {} },
  });
  return { actions, calls };
}
function form(value) {
  const data = new FormData();
  for (const [key, item] of Object.entries(value)) data.set(key, item);
  return data;
}
test('address edits and deletion always scope by session user, ignoring forged ownership', async () => {
  for (const action of ['saveAddress', 'deleteAddress']) {
    const { actions, calls } = setup();
    assert.ok(
      (await actions[action]({}, form({ ...address, id: 'address-id', user_id: 'victim' })))
        .message,
    );
    assert.ok(
      calls.some((call) => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'session-user'),
    );
    assert.ok(!JSON.stringify(calls).includes('victim'));
  }
});
test('new address owner comes from session and missing records do not report success', async () => {
  const { actions, calls } = setup();
  await actions.saveAddress({}, form({ ...address, user_id: 'victim' }));
  assert.equal(calls.find((call) => call[0] === 'insert')[1].user_id, 'session-user');
  const missing = setup({ data: null, error: null });
  assert.ok((await missing.actions.saveAddress({}, form({ ...address, id: 'unknown' }))).error);
});
test('profile action only updates permitted fields for the verified identity', async () => {
  const { actions, calls } = setup();
  await actions.saveProfile(
    {},
    form({
      id: 'victim',
      full_name: 'Cliente Teste',
      phone: '(11) 99999-9999',
      birth_date: '1990-01-01',
      role: 'super_admin',
    }),
  );
  assert.deepEqual(calls.find((call) => call[0] === 'update')[1], {
    full_name: 'Cliente Teste',
    phone: '11999999999',
    birth_date: '1990-01-01',
  });
  assert.ok(
    calls.some((call) => call[0] === 'eq' && call[1] === 'id' && call[2] === 'session-user'),
  );
});
