// Reconciles an EXISTING sandbox payment. Never creates/changes a provider payment.
const { loadEnvConfig } = require('@next/env');
const {
  testEnvironment,
  assertTestPayment,
  signedNotification,
  jsonRequest,
  serviceClient,
} = require('./lib/checkout-homologation.cjs');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

async function main() {
  const [id, countInput = '5', ...extra] = process.argv.slice(2);
  const count = Number(countInput);
  if (
    extra.length ||
    !/^\d{1,30}$/.test(id ?? '') ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 10
  )
    throw new Error('Use: npm run checkout:replay -- ID_PAGAMENTO [1-10].');
  const { origin } = testEnvironment(process.env);
  const payment = await jsonRequest(`https://api.mercadopago.com/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}` },
  });
  const db = serviceClient(process.env);
  const { data: order, error } = await db
    .from('orders')
    .select('id,is_demo,payment_test_mode,total_cents,payment_method')
    .eq('id', payment.external_reference)
    .maybeSingle();
  if (error || String(payment.id) !== id) throw new Error('Pagamento/pedido indisponível.');
  assertTestPayment(payment, order, process.env.MERCADO_PAGO_COLLECTOR_ID);
  const notification = signedNotification(id, process.env.MERCADO_PAGO_WEBHOOK_SECRET);
  const url = `${origin}/api/webhooks/mercado-pago?data.id=${id}`;
  // Exact same signature, timestamp, request ID and body, including concurrent deliveries.
  const results = await Promise.allSettled(
    Array.from({ length: count }, () => jsonRequest(url, { method: 'POST', ...notification })),
  );
  const accepted = results.filter(
    (r) => r.status === 'fulfilled' && r.value.received === true,
  ).length;
  console.log(`Reenvios aceitos: ${accepted}/${count}. Pedido de teste: ${order.id}.`);
  console.log('Confira histórico, estoque e cupom: HTTP 200 sozinho não comprova idempotência.');
  console.log('Assinatura gerada pelo script; a entrega real pelo Mercado Pago é outra evidência.');
  if (accepted !== count) process.exitCode = 1;
}

main().catch(() => {
  console.error(
    'Reenvio bloqueado. Confira ID, ambiente, credenciais, pedido e destino. Nenhum segredo foi exibido.',
  );
  process.exitCode = 1;
});
