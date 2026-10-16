// Read-only. Receives the deploy environment; deliberately never loads .env.local.
const { loadTypeScript } = require('./lib/load-typescript.cjs');

function productionChecks(env, expectedProject) {
  const checks = [];
  const check = (ok, label) => checks.push({ ok: Boolean(ok), label });
  const present = (name) => Boolean(env[name]?.trim()) && env[name] !== '[SENSITIVE]';
  let site;
  let database;
  try {
    site = new URL(env.NEXT_PUBLIC_SITE_URL);
  } catch {
    /* report below */
  }
  try {
    database = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  } catch {
    /* report below */
  }
  check(
    site?.protocol === 'https:' &&
      !site.username &&
      !site.password &&
      !['localhost', '127.0.0.1', '[::1]'].includes(site.hostname),
    'Origem pública HTTPS',
  );
  check(
    database?.origin === `https://${expectedProject}.supabase.co`,
    'Projeto Supabase corresponde à produção esperada',
  );
  check(env.MERCADO_PAGO_ENVIRONMENT === 'production', 'Mercado Pago em produção');
  check(env.MELHOR_ENVIO_ENVIRONMENT === 'production', 'Melhor Envio em produção');
  check(env.ALLOW_LOCAL_CHECKOUT_TEST !== 'true', 'Exceção de checkout local desativada');
  check(env.COMMERCE_ENABLED === 'true', 'Checkout habilitado');
  check(env.OLIST_ENABLED === 'true', 'Envio de pedidos Olist habilitado');
  check(
    env.OLIST_STOCK_ENABLED === 'true' || env.OLIST_ENABLED === 'true',
    'Leitura de estoque Olist habilitada',
  );
  for (const field of [
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'MERCADO_PAGO_ACCESS_TOKEN',
    'NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY',
    'MERCADO_PAGO_COLLECTOR_ID',
    'MERCADO_PAGO_WEBHOOK_SECRET',
    'MELHOR_ENVIO_TOKEN',
    'MELHOR_ENVIO_CONTACT_EMAIL',
    'MELHOR_ENVIO_ORIGIN_POSTAL_CODE',
    'OLIST_API_TOKEN',
    'CRON_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM_EMAIL',
  ])
    check(present(field), `${field} disponível ao processo`);
  return checks;
}

async function main() {
  const args = process.argv.slice(2);
  if (
    !/^[a-z]{20}$/.test(args[0] ?? '') ||
    args.some((arg, index) => index > 0 && arg !== '--online')
  )
    throw new Error(
      'Uso: node scripts/production-preflight.cjs <project-ref de produção> [--online]',
    );
  let failures = 0;
  const report = (ok, label) => {
    console.log(`${ok ? 'OK' : 'PENDENTE'}: ${label}`);
    if (!ok) failures++;
  };
  const checks = productionChecks(process.env, args[0]);
  checks.forEach(({ ok, label }) => report(ok, label));
  if (args.includes('--online') && !failures) {
    const account = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    const body = account.ok ? await account.json() : null;
    report(
      body && String(body.id) === process.env.MERCADO_PAGO_COLLECTOR_ID,
      'Conta Mercado Pago corresponde ao recebedor',
    );
    const { createClient } = require('@supabase/supabase-js');
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    for (const table of [
      'orders',
      'order_integrations',
      'olist_orders',
      'olist_skus',
      'email_outbox',
    ]) {
      const result = await db.from(table).select('*', { head: true, count: 'exact' });
      report(!result.error, `${table} acessível no banco de produção`);
    }
    const { olistRequest } = loadTypeScript('src/lib/integrations/olist.ts', { 'server-only': {} });
    try {
      await olistRequest('produtos.categorias.arvore.php');
      report(true, 'Token Olist aceito em leitura');
    } catch {
      report(false, 'Token Olist aceito em leitura');
    }
  }
  console.log(
    'Nenhum pedido, pagamento, cliente ou nota fiscal foi criado. Credenciais ocultadas pela Vercel não comprovam prontidão.',
  );
  console.log(
    'Ainda exige compra real: Pix aprovado, webhook do provedor, pedido/cliente Olist, NF autorizada, estoque, expedição e e-mail conciliados.',
  );
  if (failures) process.exitCode = 1;
}
if (require.main === module)
  main().catch((error) => {
    console.error(
      error.message?.startsWith('Uso:')
        ? error.message
        : 'Falha no diagnóstico de produção; nenhuma escrita foi executada.',
    );
    process.exitCode = 1;
  });
module.exports = { productionChecks };
