const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTypeScript: load } = require('../scripts/lib/load-typescript.cjs');
const { authEmail, purchaseEmail, invoiceEmail } = load('src/services/email-templates.ts');

test('exported Auth templates keep Supabase tokens and distinct recovery/confirmation purposes', () => {
  for (const kind of ['confirmation', 'recovery']) {
    const { html } = authEmail(kind);
    assert.equal(html, fs.readFileSync(`emails/supabase/${kind}.html`, 'utf8'));
    assert.match(html, /\{\{ \.SiteURL \}\}\/auth\/verificar\?token_hash=\{\{ \.TokenHash \}\}/);
    assert.ok(html.includes(`type=${kind === 'recovery' ? 'recovery' : 'email'}`));
    assert.match(html, /lang="pt-BR"/);
    assert.doesNotMatch(html, /<script|<form|<iframe/);
  }
});

test('invoice template identifies the order and attachments without exposing fiscal access tokens', () => {
  const message = invoiceEmail(
    { id: 'order-id', number: 'STUW-ABC123', customer_name: '<script>bad</script>' },
    { number: '75', series: '1', total_cents: 100 },
    'https://stuw.example',
  );
  assert.match(message.subject, /STUW-ABC123/);
  assert.match(message.html, /&lt;script&gt;/);
  assert.doesNotMatch(message.html, /<script>|doc\.view|token=/);
  assert.match(message.html, /1,00/);
  assert.match(message.text, /PDF e o XML autorizado estão anexados/);
  assert.match(message.html, /https:\/\/stuw.example\/conta\/compras\/order-id/);
  assert.throws(() => invoiceEmail({}, {}, 'http://stuw.example'));
});

test('purchase template escapes user data and reports persisted cent values', () => {
  const order = {
    id: 'order-id',
    number: 'STUW-1',
    customer_name: '<img src=x onerror=alert(1)>',
    items: [
      {
        title: '<script>alert(1)</script>',
        color: '"Black"',
        size: 'M',
        qty: 2,
        price_cents: 10000,
      },
    ],
    subtotal_cents: 20000,
    shipping_cents: 2000,
    gift_cents: 500,
    discount_cents: 1000,
    pix_discount_cents: 950,
    total_cents: 20550,
  };
  const message = purchaseEmail(order, 'https://stuw.example');
  assert.doesNotMatch(message.html, /<script>|<img /);
  assert.match(message.html, /&lt;script&gt;/);
  assert.match(message.html, /205,50/);
  assert.match(message.html, /19,50/);
  assert.match(message.text, /\/conta\/compras\/order-id/);
  assert.match(message.text, /não é uma nota fiscal/);
  assert.throws(() => purchaseEmail(order, 'javascript:alert(1)'));
});
