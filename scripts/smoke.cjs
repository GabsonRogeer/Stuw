const assert = require('node:assert/strict');
const base = process.env.SMOKE_URL || 'http://localhost:3000';
const cases = [
  ['/', 200, 'Essenciais em movimento.'],
  ['/login', 200, 'Fazer login'],
  ['/cadastro', 200, 'Confirmação de senha'],
  ['/conta', 200, 'Fazer login'],
  ['/conta/enderecos', 200, 'Fazer login'],
  ['/conta/compras', 200, 'Fazer login'],
  ['/conta/wishlist', 200, 'Fazer login'],
  ['/admin', 200, 'Fazer login'],
  ['/admin/cupons', 200, 'Fazer login'],
  ['/admin/banners', 200, 'Fazer login'],
  ['/admin/produtos', 200, 'Fazer login'],
  ['/admin/categorias', 200, 'Fazer login'],
  ['/admin/produtos/novo', 200, 'Fazer login'],
  ['/admin/produtos/1', 200, 'Fazer login'],
  ['/admin/pedidos', 200, 'Fazer login'],
  ['/admin/relatorios', 200, 'Fazer login'],
  ['/atacado', 200, 'Atacado STUW'],
  ['/atacado/cotacao', 200, 'Fazer login'],
  ['/conta/cotacoes', 200, 'Fazer login'],
  ['/conta/cotacoes/00000000-0000-0000-0000-000000000001', 200, 'Fazer login'],
  ['/admin/atacado', 200, 'Fazer login'],
  ['/admin/atacado/00000000-0000-0000-0000-000000000001', 200, 'Fazer login'],
  ['/auth/callback', 200, 'Não foi possível abrir sua sessão.'],
  ['/auth/confirm?type=recovery&token_hash=invalid', 200, 'Não foi possível abrir sua sessão.'],
  ['/produtos', 200, 'A coleção STUW'],
  ['/produtos?busca=inexistente', 200, 'Nenhuma peça nesta seleção.'],
  ['/produtos/legging-sculpt-pure-waist', 404, 'Essa página não está por aqui.'],
  ['/produtos/stuw-01', 404, 'Essa página não está por aqui.'],
  ['/produtos?categoria=Conjuntos', 200, 'A coleção STUW'],
  ['/produtos?categoria=Tops%2FCroppeds', 200, 'A coleção STUW'],
  ['/produtos?categoria=Shorts', 200, 'A coleção STUW'],
  ['/produtos/nao-existe', 404, 'Essa página não está por aqui.'],
  ['/checkout', 200, 'Fazer login'],
  ['/checkout/information', 200, 'Fazer login'],
  ['/checkout/shipping', 200, 'Fazer login'],
  ['/checkout/payment', 200, 'Fazer login'],
  ['/admin/pedidos/00000000-0000-0000-0000-000000000001', 200, 'Fazer login'],
  ['/conta/compras/00000000-0000-0000-0000-000000000001', 200, 'Fazer login'],
  ...['azul', 'preto', 'branco', 'grafite', 'rosa', 'vermelho', 'azul-marinho'].flatMap((color) => [
    [`/products/stuw-${color}/frente.jpg`, 200, null],
    [`/products/stuw-${color}/costas.jpg`, 200, null],
  ]),
];
(async () => {
  for (const [route, status, text] of cases) {
    const response = await fetch(base + route);
    assert.equal(response.status, status, route);
    if (text) {
      let html = await response.text();
      // Routes under a loading boundary may stream Next.js' redirect as a meta tag.
      const streamedRedirect = html.match(
        /<meta id="__next-page-redirect"[^>]*content="\d+;url=([^"]+)"/,
      )?.[1];
      if (streamedRedirect) {
        const destination = new URL(streamedRedirect.replaceAll('&amp;', '&'), base);
        assert.equal(destination.origin, new URL(base).origin, 'Redirect must stay on the store');
        const redirected = await fetch(destination);
        assert.equal(redirected.status, status, route);
        html = await redirected.text();
      }
      assert.ok(html.includes(text), `Missing content: ${route}`);
      if (route === '/atacado') {
        const cards = html.match(/<article\b[\s\S]*?<\/article>/g) ?? [];
        assert.ok(
          cards.every((card) => !card.includes('R$')),
          'Wholesale cards must not show retail prices',
        );
        assert.ok(html.includes(cards.length ? 'Adicionar à cotação' : 'Nenhuma peça encontrada.'));
      }
    }
    console.log(`OK ${status} ${route}`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
