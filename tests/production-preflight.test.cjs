const { test } = require('node:test');
const assert = require('node:assert/strict');
const { productionChecks } = require('../scripts/production-preflight.cjs');
const ref = 'abcdefghijklmnopqrst';
test('production preflight blocks mixed databases, sandbox shipping, hidden secrets and local exceptions', () => {
  const env = new Proxy(
    {
      NEXT_PUBLIC_SITE_URL: 'https://stuw.vercel.app',
      NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
      MERCADO_PAGO_ENVIRONMENT: 'production',
      MELHOR_ENVIO_ENVIRONMENT: 'production',
      ALLOW_LOCAL_CHECKOUT_TEST: 'false',
      COMMERCE_ENABLED: 'true',
      OLIST_ENABLED: 'true',
      OLIST_STOCK_ENABLED: 'true',
    },
    { get: (obj, name) => obj[name] ?? 'configured' },
  );
  assert.ok(productionChecks(env, ref).every((c) => c.ok));
  for (const patch of [
    { NEXT_PUBLIC_SUPABASE_URL: 'https://another.supabase.co' },
    { MELHOR_ENVIO_ENVIRONMENT: 'sandbox' },
    { ALLOW_LOCAL_CHECKOUT_TEST: 'true' },
    { MERCADO_PAGO_ACCESS_TOKEN: '[SENSITIVE]' },
    { NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' },
  ]) {
    const modified = new Proxy(patch, { get: (obj, name) => obj[name] ?? env[name] });
    assert.ok(productionChecks(modified, ref).some((c) => !c.ok));
  }
});
