// Explicit, bounded initial catalog load. Does not enable a scheduled integration.
const { loadEnvConfig } = require('@next/env');
const { loadTypeScript } = require('./lib/load-typescript.cjs');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const { syncOlistCatalog } = loadTypeScript('src/lib/integrations/olist-sync.ts', {
  'server-only': {},
});
async function main() {
  if (process.env.OLIST_ENABLED !== 'true' || process.env.OLIST_MANUAL_CATEGORY !== 'true')
    throw new Error('Assisted load flags required.');
  for (let i = 0; i < 84; i++) {
    const result = await syncOlistCatalog('export');
    console.log(JSON.stringify({ step: i + 1, ...result }));
    if (result.result === 'idle') return;
    if (!['linked', 'linked_category_pending'].includes(result.result)) {
      process.exitCode = 1;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 12000));
  }
}
main().catch(() => {
  console.error('Carga interrompida; conferir fila antes de retomar.');
  process.exitCode = 1;
});
