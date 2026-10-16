const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');

const found = {
  postalCode: '01001000',
  street: 'Praça da Sé',
  district: 'Sé',
  city: 'São Paulo',
  state: 'SP',
};
function formHarness(file, exportName, props, dependencies = {}) {
  const slots = [];
  let cursor = 0;
  let cancellations = 0;
  const lookups = [];
  const hooks = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[i],
        (value) => {
          slots[i] = typeof value === 'function' ? value(slots[i]) : value;
        },
      ];
    },
    useId() {
      return 'cep-feedback';
    },
    useActionState(action) {
      return [{}, (form) => action({}, form), false];
    },
  };
  const modules = {
    react: hooks,
    '@/hooks/use-postal-code': {
      usePostalCode: () => ({
        status: 'idle',
        message: '',
        lookup: (cep, callback) => lookups.push({ cep, callback }),
        cancel: () => {
          cancellations++;
        },
      }),
    },
    '@/app/conta/actions': {
      saveAddress: async () => ({ message: 'Salvo' }),
      deleteAddress: async () => ({}),
    },
    '@/components/ui/button/button': { Button: () => null },
    '@/components/account/PostalCodeFeedback': { PostalCodeFeedback: () => null },
    './PostalCodeFeedback': { PostalCodeFeedback: () => null },
    './ProfileForm': { accountInput: 'input' },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'lucide-react': { ArrowLeft: () => null },
    ...dependencies,
  };
  const filename = path.resolve(file);
  const compiled = new Module(filename);
  compiled.require = (name) => {
    if (name in modules) return modules[name];
    if (name.startsWith('@/services/'))
      return loadTypeScript(path.join('src', name.slice(2) + '.ts'));
    return require(name);
  };
  compiled._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return {
    lookups,
    get cancellations() {
      return cancellations;
    },
    render() {
      cursor = 0;
      return compiled.exports[exportName](props);
    },
  };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
const input = (h, name) =>
  nodes(h.render()).find((node) => node.type === 'input' && node.props.name === name);
const change = (h, name, value) => input(h, name).props.onChange({ target: { value } });

test('account address autofill is triggered by CEP editing and preserves recipient, number, complement and concurrent edits', () => {
  const address = {
    id: 'saved',
    label: 'Casa',
    recipient: 'Cliente STUW',
    postal_code: '20040002',
    street: 'Rua anterior',
    number: '17',
    complement: 'Casa',
    district: 'Centro',
    city: 'Rio de Janeiro',
    state: 'RJ',
  };
  const h = formHarness('src/components/account/AddressForm.tsx', 'AddressForm', { address });
  assert.equal(input(h, 'postal_code').props.value, '20040-002');
  assert.equal(h.lookups.length, 0, 'opening an existing address must not overwrite saved details');
  change(h, 'postal_code', '01001000');
  assert.equal(input(h, 'postal_code').props.value, '01001-000');
  assert.equal(h.lookups.length, 1);
  change(h, 'street', 'Rua informada pelo cliente');
  change(h, 'number', '99');
  change(h, 'complement', 'Apto 302');
  h.lookups[0].callback(found);
  assert.equal(input(h, 'street').props.value, 'Rua informada pelo cliente');
  assert.equal(input(h, 'city').props.value, 'São Paulo');
  assert.equal(input(h, 'district').props.value, 'Sé');
  assert.equal(input(h, 'recipient').props.value, 'Cliente STUW');
  assert.equal(input(h, 'number').props.value, '99');
  assert.equal(input(h, 'complement').props.value, 'Apto 302');
  assert.equal(nodes(h.render()).find((n) => n.type === 'select').props.value, 'SP');
  h.render().props.onSubmit();
  assert.equal(h.cancellations, 1);
});

test('checkout fills current information and cancels lookup when a saved address is selected', () => {
  const { EMPTY_INFORMATION } = loadTypeScript('src/services/checkout.ts');
  let information = {
    ...EMPTY_INFORMATION,
    email: 'customer@example.com',
    number: '17',
    complement: 'Casa',
  };
  const saved = {
    id: 'saved',
    label: 'Casa',
    street: 'Rua salva',
    number: '8',
    city: 'Rio de Janeiro',
    state: 'RJ',
  };
  const h = formHarness(
    'src/components/checkout/CheckoutInformation/CheckoutInformation.tsx',
    'CheckoutInformation',
    undefined,
    {
      '@/providers/checkout-provider': {
        useCheckout: () => ({
          information,
          addresses: [saved],
          selectedAddressId: 'saved',
          profileLoadError: false,
          updateInformation(patch) {
            information = {
              ...information,
              ...(typeof patch === 'function' ? patch(information) : patch),
            };
          },
          selectAddress() {
            information = {
              ...information,
              postalCode: '20040-002',
              street: saved.street,
              city: saved.city,
              state: saved.state,
            };
          },
          submitInformation: () => true,
        }),
      },
      '@/providers/storefront-provider': { useStorefront: () => ({ setPanel() {} }) },
    },
  );
  change(h, 'postalCode', '01001000');
  change(h, 'district', 'Bairro informado');
  h.lookups[0].callback(found);
  assert.equal(information.street, 'Praça da Sé');
  assert.equal(information.district, 'Bairro informado');
  assert.equal(information.city, 'São Paulo');
  assert.equal(information.number, '17');
  assert.equal(information.complement, 'Casa');
  const selector = nodes(h.render()).find((n) => n.type === 'select' && n.props.value === 'saved');
  selector.props.onChange({ target: { value: 'saved' } });
  assert.equal(h.cancellations, 1);
  h.lookups[0].callback(found);
  assert.equal(information.city, 'Rio de Janeiro');
  assert.equal(information.street, 'Rua salva');
});
