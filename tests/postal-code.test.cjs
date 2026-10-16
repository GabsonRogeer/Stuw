const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const service = loadTypeScript('src/services/postal-code.ts');
const { GET } = loadTypeScript('src/app/api/cep/[cep]/route.ts');
const providerAddress = {
  cep: '01001-000',
  logradouro: 'Praça da Sé',
  bairro: 'Sé',
  localidade: 'São Paulo',
  uf: 'SP',
  complemento: 'lado ímpar',
  ibge: '3550308',
};
const address = {
  postalCode: '01001000',
  street: 'Praça da Sé',
  district: 'Sé',
  city: 'São Paulo',
  state: 'SP',
};
const request = (cep) =>
  GET(new Request('https://stuw.example/api/cep/' + encodeURIComponent(cep)), {
    params: Promise.resolve({ cep }),
  });

test('CEP API validates input before contacting the fixed provider and returns only address fields', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json(providerAddress);
  });
  for (const cep of ['123', '01001-000', '010010000', '../etc', 'abcdefgh'])
    assert.equal((await request(cep)).status, 400);
  assert.equal(calls.length, 0);
  const result = await request('01001000');
  assert.equal(result.status, 200);
  assert.match(result.headers.get('cache-control'), /public/);
  assert.deepEqual(await result.json(), address);
  assert.equal(calls[0].url, 'https://viacep.com.br/ws/01001000/json/');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.cache, 'no-store');
});

test('CEP API distinguishes not-found and provider failure without caching failures', async (t) => {
  let response;
  t.mock.method(globalThis, 'fetch', async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  for (const value of [{ erro: true }, { erro: 'true' }]) {
    response = Response.json(value);
    const result = await request('99999999');
    assert.equal(result.status, 404);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  }
  for (const failure of [
    new Error('timeout'),
    new Response('unavailable', { status: 503 }),
    new Response('invalid JSON'),
    Response.json({ ...providerAddress, cep: '20040-002' }),
    Response.json({ ...providerAddress, uf: 'XX' }),
    Response.json({ ...providerAddress, localidade: '' }),
    Response.json({ ...providerAddress, logradouro: 'x'.repeat(181) }),
  ]) {
    response = failure;
    const result = await request('01001000');
    assert.equal(result.status, 503);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await result.json(), { error: 'postal_service_unavailable' });
  }
});

test('generic municipal CEPs allow manual street/district and autofill preserves concurrent manual edits', () => {
  const found = service.parsePostalAddress(
    { ...providerAddress, logradouro: '', bairro: '' },
    '01001000',
  );
  assert.equal(found.street, '');
  assert.equal(found.city, 'São Paulo');
  const baseline = {
    street: 'Rua antiga',
    district: 'Bairro antigo',
    city: 'Cidade antiga',
    state: 'RJ',
  };
  const current = {
    ...baseline,
    street: 'Rua digitada manualmente',
    number: '123',
    complement: 'Casa 2',
  };
  const patch = service.postalAddressPatch(current, baseline, address);
  assert.deepEqual(
    { ...current, ...patch },
    {
      street: 'Rua digitada manualmente',
      district: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      number: '123',
      complement: 'Casa 2',
    },
  );
  assert.equal(service.formatPostalCode('01001000'), '01001-000');
  assert.equal(service.formatPostalCode('01001-000'), '01001-000');
});

function hookHarness() {
  const slots = [];
  let cursor = 0;
  const { usePostalCode } = loadTypeScript('src/hooks/use-postal-code.ts', {
    react: {
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
      useRef(initial) {
        const i = cursor++;
        return (slots[i] ??= { current: initial });
      },
      useEffect(callback) {
        const i = cursor++;
        slots[i] ??= { cleanup: callback() };
      },
    },
  });
  return {
    render() {
      cursor = 0;
      return usePostalCode();
    },
    unmount() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
  };
}
const flush = () => new Promise(setImmediate);

test('CEP lookup debounces complete input and ignores stale replies even if abort is ignored', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  t.mock.method(
    globalThis,
    'fetch',
    (url, options) => new Promise((resolve) => calls.push({ url, options, resolve })),
  );
  const h = hookHarness();
  t.after(() => h.unmount());
  const found = [];
  h.render().lookup('01001', (value) => found.push(value));
  t.mock.timers.tick(400);
  assert.equal(calls.length, 0);
  h.render().lookup('01001000', (value) => found.push(value));
  t.mock.timers.tick(349);
  assert.equal(calls.length, 0);
  t.mock.timers.tick(1);
  assert.equal(calls.length, 1);
  h.render().lookup('20040002', (value) => found.push(value));
  assert.equal(calls[0].options.signal.aborted, true);
  t.mock.timers.tick(350);
  const newer = { ...address, postalCode: '20040002', city: 'Rio de Janeiro', state: 'RJ' };
  calls[1].resolve(Response.json(newer));
  await flush();
  calls[0].resolve(Response.json(address));
  await flush();
  assert.deepEqual(found, [newer]);
  assert.equal(h.render().status, 'success');
});

test('cancellation also ignores a response still parsing and timeout permits a manual retry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let mode = 'parsing';
  let completeJson;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    if (mode === 'parsing')
      return {
        ok: true,
        status: 200,
        json: () =>
          new Promise((resolve) => {
            completeJson = resolve;
          }),
      };
    if (mode === 'timeout')
      return new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('timeout'))),
      );
    return Response.json(address);
  });
  const h = hookHarness();
  t.after(() => h.unmount());
  const found = [];
  h.render().lookup('01001000', (value) => found.push(value));
  t.mock.timers.tick(350);
  await flush();
  h.render().cancel();
  completeJson(address);
  await flush();
  assert.equal(found.length, 0);
  mode = 'timeout';
  h.render().lookup('01001000', (value) => found.push(value));
  t.mock.timers.tick(350);
  await flush();
  t.mock.timers.tick(8000);
  await flush();
  assert.equal(h.render().status, 'error');
  mode = 'success';
  h.render().lookup('01001000', (value) => found.push(value));
  t.mock.timers.tick(350);
  await flush();
  assert.deepEqual(found, [address]);
});

test('unmount cancels in-flight CEP requests and not-found leaves manual entry available', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let mode = 'not_found';
  let resolve;
  t.mock.method(globalThis, 'fetch', async () =>
    mode === 'not_found'
      ? new Response(null, { status: 404 })
      : new Promise((done) => {
          resolve = done;
        }),
  );
  const h = hookHarness();
  const found = [];
  h.render().lookup('99999999', (value) => found.push(value));
  t.mock.timers.tick(350);
  await flush();
  assert.equal(h.render().status, 'not_found');
  assert.equal(found.length, 0);
  mode = 'pending';
  h.render().lookup('01001000', (value) => found.push(value));
  t.mock.timers.tick(350);
  await flush();
  h.unmount();
  resolve(Response.json(address));
  await flush();
  assert.equal(found.length, 0);
});
