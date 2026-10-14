const assert = require('node:assert/strict');
const { loadTypeScript: load } = require('../../scripts/lib/load-typescript.cjs');
const { signedNotification } = require('../../scripts/lib/checkout-homologation.cjs');

// Real route, signature verification, payment validation and SQL migration functions.
// Only the provider response and the Supabase HTTP transport are substituted.
function databaseWebhook(db) {
  let payment;
  const config = {
    commerceConfig: () => ({ production: false }),
    requiredEnv: (name) => (name === 'MERCADO_PAGO_COLLECTOR_ID' ? '123' : 'sandbox-secret'),
  };
  const mp = load('src/lib/integrations/mercado-pago.ts', {
    'server-only': {},
    './config': config,
    './http': {
      integrationRequest: async (_provider, url) => {
        assert.equal(url, `https://api.mercadopago.com/v1/payments/${payment.id}`);
        return payment;
      },
    },
  });
  const service = {
    from: (table) => {
      assert.equal(table, 'orders');
      let id;
      return {
        select() {
          return this;
        },
        eq(column, value) {
          assert.equal(column, 'id');
          id = value;
          return this;
        },
        maybeSingle: async () => ({
          data: (await db.query('select * from public.orders where id=$1', [id])).rows[0],
        }),
      };
    },
    rpc: async (name, args) => {
      assert.equal(name, 'apply_checkout_payment');
      await db.query('select public.apply_checkout_payment($1,$2,$3,$4)', [
        args.input_id,
        args.provider_id,
        args.next_status,
        args.provider_time,
      ]);
      return {};
    },
  };
  const runtime = load('src/lib/integrations/checkout.ts', {
    'server-only': {},
    '@/lib/supabase/service': { createServiceClient: () => service },
    '@/services/checkout-integration': {},
    '@/services/fulfillment': load('src/services/fulfillment.ts'),
    '@/lib/commerce': { FREE_SHIPPING_THRESHOLD: 499 },
    './config': config,
    './mercado-pago': mp,
    './melhor-envio': {},
  });
  const route = load('src/app/api/webhooks/mercado-pago/route.ts', {
    '@/lib/integrations/mercado-pago': mp,
    '@/lib/integrations/checkout': runtime,
  });
  return async (value, copies = 5) => {
    payment = value;
    const signed = signedNotification(String(payment.id), 'sandbox-secret');
    const responses = await Promise.all(
      Array.from({ length: copies }, () =>
        route.POST(
          new Request(`https://stuw.example/api/webhooks/mercado-pago?data.id=${payment.id}`, {
            method: 'POST',
            ...signed,
          }),
        ),
      ),
    );
    assert.ok(responses.every((response) => response.status === 200));
  };
}

module.exports = { databaseWebhook };
