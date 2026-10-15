const fs = require('node:fs');
const { loadEnvConfig } = require('@next/env');
const { loadTypeScript } = require('./lib/load-typescript.cjs');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const { createServiceClient } = loadTypeScript('src/lib/supabase/service.ts', {
  'server-only': {},
});
const { listOlistProducts, getOlistProduct, olistRequest } = loadTypeScript(
  'src/lib/integrations/olist.ts',
  { 'server-only': {} },
);
async function main() {
  const db = createServiceClient();
  const [products, links] = await Promise.all([
    db.from('admin_products').select('id,document').gte('id', 1000000).lte('id', 1000020),
    db
      .from('olist_skus')
      .select('sku,remote_id,state,last_error')
      .gte('product_id', 1000000)
      .lte('product_id', 1000020),
  ]);
  if (products.error || links.error || products.data.length !== 21)
    throw Error('Catalog unavailable');
  const remote = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const result = await listOlistProducts(page, 'STUW');
    remote.push(...result.products);
    pages = result.pages;
    await new Promise((r) => setTimeout(r, 4000));
  }
  const rows = [];
  for (const p of products.data)
    for (const c of p.document.colors)
      for (const s of c.skus) {
        const link = links.data.find((l) => l.sku === s.code);
        const matches = remote.filter((r) => r.codigo === s.code);
        const valid =
          link?.state === 'linked' &&
          matches.length === 1 &&
          String(matches[0].id) === link.remote_id;
        rows.push({
          sku: s.code,
          id: link?.remote_id ?? '',
          type: s.components?.length ? 'Conjunto' : 'Peça',
          stock: s.stock,
          state: valid ? 'Conferido' : 'Pendente',
          category: link?.last_error?.includes('Categoria Stuw')
            ? 'Atribuir Stuw'
            : 'Stuw confirmada',
        });
      }
  rows.sort((a, b) => a.sku.localeCompare(b.sku));
  // Check one complete kit and its component balances, including GG zero.
  const samples = [];
  for (const code of [
    'STUW-TOP-AZUL-M',
    'STUW-SHORT-AZUL-M',
    'STUW-CONJ-AZUL-M',
    'STUW-TOP-AZUL-GG',
    'STUW-SHORT-AZUL-GG',
    'STUW-CONJ-AZUL-GG',
  ]) {
    const link = links.data.find((l) => l.sku === code);
    if (!link?.remote_id) continue;
    const product = await getOlistProduct(link.remote_id);
    await new Promise((r) => setTimeout(r, 4000));
    const balance = await olistRequest('produto.obter.estoque.php', { id: link.remote_id });
    samples.push({
      sku: code,
      price: product.preco,
      images: product.imagens_externas?.length ?? 0,
      class: product.classe_produto,
      variation: product.tipoVariacao,
      kit: product.kit,
      balance: { saldo: balance.produto?.saldo, saldoReservado: balance.produto?.saldoReservado },
    });
    await new Promise((r) => setTimeout(r, 4000));
  }
  const verified = rows.filter((r) => r.state === 'Conferido').length;
  const text = [
    '# Carga inicial Stuw na Olist',
    '',
    `Conferência: ${new Date().toISOString()}. ${verified}/${rows.length} SKUs com identidade única e vínculo confirmado.`,
    '',
    'A categoria será atribuída manualmente pelo usuário. Os cadastros antigos com prefixo OLD- não fazem parte desta lista.',
    '',
    '| SKU | ID Olist | Tipo | Saldo no site | Vínculo | Categoria |',
    '| --- | --- | --- | ---: | --- | --- |',
    ...rows.map(
      (r) => `| ${r.sku} | ${r.id} | ${r.type} | ${r.stock} | ${r.state} | ${r.category} |`,
    ),
    '',
    '## Amostra de conferência na Olist',
    '',
    '```json',
    JSON.stringify(samples, null, 2),
    '```',
    '',
    'A carga de cadastro não comprova sincronização contínua de estoque, emissão fiscal ou fluxo de compra real.',
    '',
  ].join('\n');
  fs.writeFileSync('docs/olist-initial-load-report.md', text);
  console.log(
    JSON.stringify({
      total: rows.length,
      verified,
      categoryPending: rows.filter((r) => r.category === 'Atribuir Stuw').length,
      samples,
    }),
  );
  if (verified !== 84) process.exitCode = 1;
}
main().catch(() => {
  console.error('Conferência interrompida.');
  process.exitCode = 1;
});
