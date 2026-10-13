const fs = require('node:fs');
const path = require('node:path');
const { loadTypeScript } = require('./lib/load-typescript.cjs');
const { createProductionProducts } = loadTypeScript('src/data/production-products.ts');
const { validateProduct } = loadTypeScript('src/services/product-admin.ts');
const tables = [
  'public.orders',
  'public.order_events',
  'public.order_integrations',
  'public.checkout_shipping_quotes',
  'public.wholesale_quotes',
  'public.wholesale_quote_events',
  'public.coupons',
  'public.coupon_redemptions',
  'public.admin_products',
  'public.catalog_products',
  'private.product_colors',
  'private.product_skus',
  'private.product_slugs',
  'private.product_audit',
  'private.product_identifiers',
  'private.product_wholesale_terms',
  'private.checkout_products',
  'public.product_categories',
];
const snapshot = (table) =>
  `(select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from ${table} t)`;
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
function buildResetSql() {
  const products = createProductionProducts();
  for (const product of products) {
    const error = validateProduct(product);
    if (error) throw new Error(`${product.name}: ${error}`);
    for (const color of product.colors)
      for (const image of color.images) {
        const file = path.join('public', image.src);
        if (!fs.existsSync(file)) throw new Error(`Imagem ausente: ${file}`);
        if (fs.statSync(file).size > 5 * 1024 * 1024)
          throw new Error(`Imagem acima de 5 MB: ${file}`);
      }
  }
  const template = fs.readFileSync('supabase/operations/replace-catalog.template.sql', 'utf8');
  return template
    .replace('-- LOCK_TABLES', `lock table ${tables.join(', ')} in share row exclusive mode;`)
    .replace(
      '-- PRODUCT_DOCUMENTS',
      `insert into new_catalog_documents(document) select value from jsonb_array_elements(${quote(JSON.stringify(products))}::jsonb);`,
    );
}
function prepare() {
  fs.mkdirSync('.local-backups/catalog-reset', { recursive: true });
  fs.writeFileSync('supabase/operations/replace-catalog.sql', buildResetSql());
  fs.writeFileSync(
    '.local-backups/catalog-reset/snapshot.sql',
    `select jsonb_build_object(${tables.map((t) => `${quote(t)}, ${snapshot(t)}`).join(',\n')}) as snapshot;\n`,
  );
  console.log(
    'SQL preparado: 21 rascunhos, 63 SKUs, 3 categorias e Training. Nenhum dado remoto alterado.',
  );
}
function guard(backupPath) {
  const raw = fs.readFileSync(backupPath, 'utf8').replace(/^\uFEFF/, '');
  const result = JSON.parse(raw.slice(raw.indexOf('{')));
  const saved = result.rows?.[0]?.snapshot;
  if (!saved || tables.some((table) => !Array.isArray(saved[table])))
    throw new Error('Backup incompleto.');
  const checks = tables
    .map(
      (table) =>
        `if ${snapshot(table)} <> ${quote(JSON.stringify(saved[table]))}::jsonb then raise exception 'Dados alterados desde o backup: ${table}'; end if;`,
    )
    .join('\n');
  const sql = buildResetSql().replace(
    '-- SNAPSHOT_GUARD',
    `do $snapshot_guard$ begin\n${checks}\nend $snapshot_guard$;`,
  );
  fs.writeFileSync('.local-backups/catalog-reset/execute.sql', sql);
  console.log(JSON.stringify(Object.fromEntries(tables.map((t) => [t, saved[t].length])), null, 2));
  console.log(
    'Operação protegida preparada; aborta se qualquer registro afetado mudar desde o backup.',
  );
}
if (require.main === module) {
  if (process.argv[2] === '--guard' && process.argv[3]) guard(process.argv[3]);
  else prepare();
}
module.exports = { buildResetSql, tables };
