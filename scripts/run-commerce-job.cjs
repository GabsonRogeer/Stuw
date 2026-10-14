// One authenticated reconciliation of existing orders; no background scheduler.
const { loadEnvConfig } = require('@next/env');
const { runCommerceJob } = require('./lib/commerce-job.cjs');
if (!process.argv.includes('--process-env'))
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--process-env'))
    throw new Error('Argumento inválido.');
  const result = await runCommerceJob(process.env);
  console.log(`Lote consultado: ${result.processed}; falhas: ${result.failed}.`);
  console.log(
    'Uma execução manual não comprova agendamento nem recuperação de pagamento. Confira o pedido.',
  );
  if (result.failed) process.exitCode = 1;
}

main().catch(() => {
  console.error('Execução não confirmada. Confira ambiente, segredo, destino e logs do servidor.');
  console.error('Em caso de timeout, o servidor pode ter continuado; não há repetição automática.');
  process.exitCode = 1;
});
