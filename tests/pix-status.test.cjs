const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');

test('Pix hides expired codes, keeps polling, accepts later approval and cleans up timers', async (t) => {
  const start = Date.parse('2026-10-13T12:00:00Z');
  t.mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: start });
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const document = new EventTarget();
  document.visibilityState = 'visible';
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  const slots = [];
  let cursor = 0;
  let effects = [];
  let polls = 0;
  let status = 'pending';
  const initial = {
    id: 'order-id',
    code: 'STUW-PIX',
    total: 10,
    paymentStatus: 'pending',
    testMode: true,
    pix: {
      code: 'test-pix-code',
      image: 'test-image',
      expiresAt: new Date(start + 30000).toISOString(),
    },
  };
  const hooks = {
    ...React,
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value;
      return [
        slots[index],
        (next) => {
          slots[index] = typeof next === 'function' ? next(slots[index]) : next;
        },
      ];
    },
    useRef(value) {
      const index = cursor++;
      return (slots[index] ??= { current: value });
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const prior = slots[index];
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
        effects.push(() => {
          prior?.cleanup?.();
          slots[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const dependencies = {
    react: hooks,
    'next/image': {
      default: ({ unoptimized, ...props }) => {
        void unoptimized;
        return React.createElement('img', props);
      },
    },
    'next/link': { default: (props) => React.createElement('a', props) },
    '@/app/actions/order': {
      checkOrderPayment: async () => {
        polls++;
        return { order: { ...initial, paymentStatus: status, pix: undefined } };
      },
    },
    '@/services/fulfillment': loadTypeScript('src/services/fulfillment.ts'),
    '@/lib/commerce': { currency: (value) => `R$ ${value}` },
    '@/providers/cart-provider': { useCart: () => ({ clear() {} }) },
  };
  const filename = path.resolve('src/components/checkout/PaymentStatus.tsx');
  const compiled = new Module(filename);
  compiled.require = (name) => (name in dependencies ? dependencies[name] : require(name));
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
  const render = () => {
    cursor = 0;
    const tree = compiled.exports.PaymentStatus({ initial });
    const html = renderToStaticMarkup(tree);
    const pending = effects;
    effects = [];
    pending.forEach((effect) => effect());
    return { html, tree };
  };
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  try {
    assert.doesNotMatch(render().html, /test-pix-code|test-image/);
    t.mock.timers.tick(0);
    await flush();
    let view = render();
    const findCopy = (node) => {
      if (!node || typeof node !== 'object') return undefined;
      if (node.type === 'button') return node.props.onClick;
      return React.Children.toArray(node.props?.children).map(findCopy).find(Boolean);
    };
    const copy = findCopy(view.tree);
    assert.equal(typeof copy, 'function');
    assert.match(view.html, /test-pix-code/);
    assert.match(view.html, /Copiar código Pix/);
    t.mock.timers.tick(29999);
    await flush();
    assert.match(render().html, /test-pix-code/);
    // Advance wall time without running timers: a suspended tab can still have an old button.
    t.mock.timers.setTime(start + 30000);
    await copy();
    await flush();
    view = render();
    assert.match(view.html, /Código Pix vencido/);
    assert.doesNotMatch(
      view.html,
      /test-pix-code|test-image|Copiar código Pix|Iniciar nova tentativa/,
    );
    const previousPolls = polls;
    t.mock.timers.tick(20000);
    await flush();
    assert.ok(polls > previousPolls, 'expiry does not stop reconciliation');
    assert.match(render().html, /Código Pix vencido/);
    status = 'approved';
    t.mock.timers.tick(20000);
    await flush();
    assert.match(render().html, /Pagamento aprovado/);
    const finalPolls = polls;
    t.mock.timers.tick(40000);
    await flush();
    assert.equal(polls, finalPolls, 'terminal payment stops polling');
  } finally {
    slots.forEach((slot) => slot?.cleanup?.());
    if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument);
    else delete globalThis.document;
  }
});
