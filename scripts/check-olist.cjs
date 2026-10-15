const { loadEnvConfig } = require('@next/env');
const { loadTypeScript } = require('./lib/load-typescript.cjs');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const api = loadTypeScript('src/lib/integrations/olist.ts', { 'server-only': {} });
async function main() {
  const { products, pages } = await api.listOlistProducts();
  console.log(
    JSON.stringify({
      connected: true,
      firstPageCount: products.length,
      pages,
      writesEnabled: process.env.OLIST_ENABLED === 'true',
    }),
  );
  // Only catalog IDs/SKUs; never tokens, customers or fiscal documents.
  if (process.argv.includes('--catalog'))
    for (const item of products)
      console.log(
        JSON.stringify({
          id: item.id,
          sku: item.codigo,
          name: item.nome,
          variant: item.tipoVariacao,
        }),
      );
}
main().catch((error) => {
  console.error(error instanceof api.OlistError ? error.message : 'Falha no diagnóstico Olist.');
  process.exitCode = 1;
});
