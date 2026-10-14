// Read-only diagnostics: no orders, charges, jobs or signed notifications are created.
const { loadEnvConfig } = require('@next/env');
const { testEnvironment, jsonRequest, serviceClient } = require('./lib/checkout-homologation.cjs');
// Use with an explicit environment export. Vercel env run itself loads .env.local.
if (!process.argv.includes('--process-env'))
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--online', '--process-env'].includes(arg)))
    throw new Error('Opções permitidas: --online e --process-env.');
  if (Object.values(process.env).includes('[SENSITIVE]')) {
    console.error(
      'Exportação contém segredos ocultos pela Vercel; não permite validar a configuração.',
    );
    process.exitCode = 1;
    return;
  }
  const { origin, local } = testEnvironment(process.env);
  let failures = 0;
  const report = (ok, label) => {
    console.log(`${ok ? 'OK' : 'PENDENTE'}: ${label}`);
    if (!ok) failures++;
  };
  console.log(
    args.includes('--process-env')
      ? 'Diagnóstico das variáveis fornecidas ao processo, sem carregar .env.local.'
      : 'Diagnóstico das variáveis locais; não comprova as variáveis do deploy.',
  );
  console.log(`Origem configurada: ${origin}`);
  report(process.env.COMMERCE_ENABLED === 'true', 'checkout habilitado em teste');
  for (const field of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY',
    'MERCADO_PAGO_ACCESS_TOKEN',
    'MERCADO_PAGO_COLLECTOR_ID',
    'MERCADO_PAGO_WEBHOOK_SECRET',
    'MELHOR_ENVIO_TOKEN',
    'MELHOR_ENVIO_CONTACT_EMAIL',
    'MELHOR_ENVIO_ORIGIN_POSTAL_CODE',
    'CRON_SECRET',
  ])
    report(Boolean(process.env[field]?.trim()), `${field} preenchida`);
  report(
    !local && process.env.ALLOW_LOCAL_CHECKOUT_TEST !== 'true',
    'origem pública HTTPS e teste local desativado para homologar webhooks',
  );

  if (args.includes('--online')) {
    try {
      const account = await jsonRequest('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}` },
      });
      report(
        String(account.id) === process.env.MERCADO_PAGO_COLLECTOR_ID,
        'token aceito na consulta de conta; recebedor corresponde',
      );
      console.log(
        'A consulta de conta não comprova permissão de criar pagamentos nem o modo da credencial.',
      );
    } catch {
      report(false, 'não foi possível validar a conta Mercado Pago (credencial ou rede)');
    }
    try {
      const db = serviceClient(process.env);
      for (const table of [
        'orders',
        'order_integrations',
        'checkout_shipping_quotes',
        'catalog_products',
      ]) {
        const { error } = await db.from(table).select('*', { head: true, count: 'exact' });
        report(!error, `${table} acessível com chave de servidor`);
      }
    } catch {
      report(false, 'conexão de servidor Supabase');
    }
    // No credentials: these requests must never run the commerce job.
    for (const [path, method] of [
      ['/api/webhooks/mercado-pago?data.id=1', 'POST'],
      ['/api/jobs/commerce', 'GET'],
    ]) {
      try {
        const response = await fetch(origin + path, {
          method,
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        });
        const body = await response.json().catch(() => null);
        const expected = method === 'POST' ? 'Invalid signature' : 'Unauthorized';
        report(
          response.status === 401 && body?.error === expected,
          `${path.split('?')[0]} rejeita chamada sem autenticação`,
        );
      } catch {
        report(false, `${path.split('?')[0]} acessível na origem configurada`);
      }
    }
  }
  console.log(
    'Ainda exigem evidência: cartão/Pix, webhook assinado do provedor, cron agendado e expiração.',
  );
  if (failures) process.exitCode = 1;
}

main().catch(() => {
  console.error(
    'Diagnóstico bloqueado. Confira argumentos, ambiente test/sandbox e URL de origem.',
  );
  process.exitCode = 1;
});
