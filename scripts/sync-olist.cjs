const { loadEnvConfig } = require('@next/env');
const { loadTypeScript } = require('./lib/load-typescript.cjs');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const direction = process.argv[2];
if (!['export', 'import', 'orders', 'stock'].includes(direction) || process.argv.length !== 3) {
  console.error(
    'Uso: node scripts/sync-olist.cjs export|import|orders|stock (estoque: até 12 SKUs por execução).',
  );
  process.exitCode = 1;
} else {
  const { syncOlistCatalog } = loadTypeScript('src/lib/integrations/olist-sync.ts', {
    'server-only': {},
  });
  syncOlistCatalog(direction)
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error('Execução não confirmada. Consulte a fila Olist antes de repetir.');
      process.exitCode = 1;
    });
}
