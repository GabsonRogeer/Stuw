const { createHmac, randomUUID } = require('node:crypto');

function testEnvironment(env) {
  if (env.MERCADO_PAGO_ENVIRONMENT !== 'test' || env.MELHOR_ENVIO_ENVIRONMENT !== 'sandbox')
    throw new Error('Este comando exige Mercado Pago test e Melhor Envio sandbox.');
  const site = new URL(env.NEXT_PUBLIC_SITE_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
  if (site.username || site.password || site.search || site.hash || site.pathname !== '/')
    throw new Error('NEXT_PUBLIC_SITE_URL deve conter apenas a origem do site.');
  if (site.protocol !== 'https:' && !(local && site.protocol === 'http:'))
    throw new Error('O destino deve usar HTTPS ou HTTP em localhost.');
  return { origin: site.origin, local };
}

function assertTestPayment(payment, order, collector) {
  if (
    !payment ||
    payment.live_mode !== false ||
    String(payment.collector_id) !== collector ||
    !order ||
    order.is_demo !== false ||
    order.payment_test_mode !== true ||
    payment.external_reference !== order.id ||
    payment.currency_id !== 'BRL' ||
    Math.round(payment.transaction_amount * 100) !== order.total_cents ||
    (order.payment_method === 'pix'
      ? payment.payment_method_id !== 'pix'
      : payment.payment_type_id !== 'credit_card')
  )
    throw new Error('Reenvio bloqueado: pagamento e pedido de teste não correspondem.');
}

function signedNotification(id, secret, now = Date.now()) {
  if (!/^\d{1,30}$/.test(id) || !secret) throw new Error('ID ou segredo ausente/inválido.');
  const ts = String(now);
  const requestId = randomUUID();
  const signature = createHmac('sha256', secret)
    .update(`id:${id};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  return {
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      'x-signature': `ts=${ts},v1=${signature}`,
    },
    body: JSON.stringify({ type: 'payment', data: { id } }),
  };
}

async function jsonRequest(url, init = {}, fetcher = fetch) {
  const response = await fetcher(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Consulta recusada: HTTP ${response.status}.`);
  return response.json();
}

function serviceClient(env) {
  const { createClient } = require('@supabase/supabase-js');
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Configure URL e chave de servidor Supabase.');
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) },
  });
}

module.exports = {
  testEnvironment,
  assertTestPayment,
  signedNotification,
  jsonRequest,
  serviceClient,
};
