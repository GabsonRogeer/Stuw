const fs = require('node:fs');
const { loadTypeScript } = require('./lib/load-typescript.cjs');
const { authEmail, purchaseEmail } = loadTypeScript('src/services/email-templates.ts');
fs.mkdirSync('emails/supabase', { recursive: true });
fs.mkdirSync('emails/previews', { recursive: true });
for (const kind of ['confirmation', 'recovery']) {
  const template = authEmail(kind);
  fs.writeFileSync(`emails/supabase/${kind}.html`, template.html);
  fs.writeFileSync(
    `emails/previews/${kind}.html`,
    template.html
      .replaceAll('{{ .SiteURL }}', 'https://stuw.com.br')
      .replaceAll('{{ .TokenHash }}', 'preview-invalid-token'),
  );
}
const sample = {
  id: '00000000-0000-0000-0000-000000000000',
  number: 'PRÉVIA-001',
  customer_name: 'Cliente STUW',
  items: [{ title: 'Conjunto Sculpt', color: 'Preto', size: 'M', qty: 1, price_cents: 29900 }],
  subtotal_cents: 29900,
  shipping_cents: 1990,
  gift_cents: 0,
  discount_cents: 0,
  pix_discount_cents: 1495,
  total_cents: 30395,
};
fs.writeFileSync(
  'emails/previews/purchase.html',
  purchaseEmail(sample, 'https://stuw.com.br').html,
);
console.log('Templates Supabase e prévias HTML exportados. Nenhum e-mail enviado.');
