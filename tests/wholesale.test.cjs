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
const wholesale = load('src/services/wholesale.ts', { './checkout': checkout });
const product = {
  id: 1,
  title: 'Trusted',
  image: '/test.jpg',
  sizes: ['M'],
  colors: [{ name: 'Black' }],
};
test('wholesale basket restores trusted variants without prices, rejects corruption and merges quantities', () => {
  const items = wholesale.restoreWholesale(
    [
      { id: 1, size: 'M', color: 'Black', qty: 10, title: 'Forged', price: 1 },
      { id: 1, size: 'M', color: 'Black', qty: 5 },
      { id: 1, size: 'X', color: 'Black', qty: 1 },
      { id: 1, size: 'M', color: 'Black', qty: -1 },
    ],
    [product],
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].qty, 15);
  assert.equal(items[0].title, 'Trusted');
  assert.equal(items[0].price, undefined);
  assert.deepEqual(wholesale.restoreWholesale(null, [product]), []);
});
test('CNPJ is optional but invalid or CPF values are rejected when supplied', () => {
  const contact = { name: 'Cliente', phone: '11999999999', company: '', cnpj: '', notes: '' };
  assert.equal(wholesale.validWholesaleContact(contact), null);
  assert.ok(wholesale.validWholesaleContact({ ...contact, cnpj: '52998224725' }));
  assert.ok(wholesale.validWholesaleContact({ ...contact, cnpj: '00000000000000' }));
  assert.equal(wholesale.validWholesaleContact({ ...contact, cnpj: '11222333000181' }), null);
});
test('WhatsApp URL is encoded, bounded and never claims automatic sending', () => {
  const quote = {
    number: 'ATC-1',
    quantity: 1,
    items: [{ ...product, size: 'M', color: 'Black & White', qty: 1 }],
  };
  assert.equal(wholesale.quoteWhatsAppUrl('', quote), null);
  assert.equal(wholesale.quoteWhatsAppUrl('javascript:bad', quote), null);
  const url = new URL(wholesale.quoteWhatsAppUrl('5511999999999', quote));
  assert.equal(url.hostname, 'wa.me');
  assert.match(url.searchParams.get('text'), /Black & White/);
  const long = wholesale.quoteWhatsAppUrl('5511999999999', {
    ...quote,
    items: Array(50).fill({ ...quote.items[0], title: 'a'.repeat(200) }),
  });
  assert.ok(long.length < 2000);
});
test('unauthenticated quote submission cannot write to the database', async () => {
  const actions = load('src/app/actions/wholesale.ts', {
    'next/cache': { revalidatePath() {} },
    '@/services/orders': { isUuid: () => true },
    '@/services/wholesale': wholesale,
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
        rpc: () => assert.fail('Unauthorized write'),
      }),
    },
  });
  const result = await actions.createQuote({
    key: 'key',
    name: 'Cliente',
    phone: '11999999999',
    company: '',
    cnpj: '',
    notes: '',
    items: [{ id: 1, size: 'M', color: 'Black', qty: 1 }],
  });
  assert.equal(result.loginRequired, true);
});

test('wholesale admin operations reject unauthorized callers before database access', async () => {
  const actions = load('src/app/admin/atacado/actions.ts', {
    'next/cache': { revalidatePath() {} },
    '@/services/orders': { isUuid: () => true },
    '@/services/wholesale': wholesale,
    '@/lib/supabase/admin': {
      requireAdmin: async () => {
        throw new Error('Denied');
      },
    },
  });
  assert.ok((await actions.saveWholesaleSettings({}, new FormData())).error);
  assert.ok((await actions.updateQuote({}, new FormData())).error);
});
