const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');
const { loadTypeScript } = require('./lib/load-typescript.cjs');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const { productExportIssues } = loadTypeScript('src/services/olist-catalog.ts');
async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  let offset = 0;
  let total = 0;
  let ready = 0;
  for (;;) {
    const { data, error } = await db
      .from('admin_products')
      .select('*')
      .is('deleted_at', null)
      .order('id')
      .range(offset, offset + 99);
    if (error) throw new Error();
    for (const product of data) {
      const issues = productExportIssues(product);
      console.log(JSON.stringify({ id: product.id, name: product.document.name, issues }));
      total++;
      if (!issues.length) ready++;
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  console.log(JSON.stringify({ total, ready, blocked: total - ready, mutation: false }));
}
main().catch(() => {
  console.error('Não foi possível conferir o catálogo. Verifique a configuração Supabase.');
  process.exitCode = 1;
});
