const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const { olistRequest } = loadTypeScript('src/lib/integrations/olist.ts', { 'server-only': {} });
test('Olist validates credentials server-side, normalizes empty categories, and never retries writes', async (t) => {
  const token = process.env.OLIST_API_TOKEN;
  const enabled = process.env.OLIST_ENABLED;
  t.after(() => {
    if (token === undefined) delete process.env.OLIST_API_TOKEN;
    else process.env.OLIST_API_TOKEN = token;
    if (enabled === undefined) delete process.env.OLIST_ENABLED;
    else process.env.OLIST_ENABLED = enabled;
  });
  process.env.OLIST_API_TOKEN = 'test-secret';
  process.env.OLIST_ENABLED = 'false';
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(options.body.get('token'), 'test-secret');
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify({ retorno: [] }));
  });
  await assert.rejects(olistRequest('produto.incluir.php'), /DISABLED/);
  assert.equal(calls, 0);
  assert.deepEqual(await olistRequest('produtos.categorias.arvore.php'), {
    status: 'OK',
    categorias: [],
  });
  process.env.OLIST_ENABLED = 'true';
  const before = calls;
  await assert.rejects(
    olistRequest('produto.incluir.php'),
    (error) => error.uncertain && error.code === 'RESPONSE_INVALID',
  );
  assert.equal(calls, before + 1);
});
