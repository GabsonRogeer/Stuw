const { testEnvironment } = require('./checkout-homologation.cjs');

async function runCommerceJob(env, fetcher = fetch) {
  const { origin } = testEnvironment(env);
  const secret = env.CRON_SECRET?.trim();
  if (!secret || secret === '[SENSITIVE]') throw new Error('Configure CRON_SECRET.');
  const response = await fetcher(`${origin}/api/jobs/commerce`, {
    headers: { Authorization: `Bearer ${secret}` },
    redirect: 'error',
    signal: AbortSignal.timeout(70000),
  });
  if (!response.ok) throw new Error(`Job recusado: HTTP ${response.status}.`);
  const result = await response.json();
  if (
    !Number.isInteger(result?.processed) ||
    result.processed < 0 ||
    result.processed > 10 ||
    !Number.isInteger(result?.failed) ||
    result.failed < 0 ||
    result.failed > result.processed
  )
    throw new Error('Resposta inesperada do job.');
  return { processed: result.processed, failed: result.failed };
}

module.exports = { runCommerceJob };
