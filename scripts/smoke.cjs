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
  ['/admin/pedidos', 200, 'Fazer login'],
  ['/admin/relatorios', 200, 'Fazer login'],
  ['/auth/callback', 200, 'Não foi possível abrir sua sessão.'],
  ['/auth/confirm?type=recovery&token_hash=invalid', 200, 'Não foi possível abrir sua sessão.'],
  ['/produtos', 200, 'A coleção STUW'],
  ['/produtos?busca=macacao', 200, 'Macacão SilkAir'],
  ['/produtos?busca=inexistente', 200, 'Nenhuma peça nesta seleção.'],
  ['/produtos/legging-sculpt-pure-waist', 200, 'Legging Sculpt Pure Waist'],
  ['/produtos/stuw-mocha-sculpt-set', 200, 'STUW Mocha Sculpt Set'],
  ['/produtos/stuw-run-set-mauve', 200, 'STUW Run Set'],
  ['/produtos/stuw-move-zip-set', 200, 'STUW Move Zip Set'],
  ['/produtos/stuw-studio-half-zip-set', 200, 'STUW Studio Half-Zip Set'],
  ['/produtos/stuw-active-run-set', 200, 'STUW Active Run Set'],
  ['/produtos/stuw-sculpt-set-mocha', 200, 'STUW Sculpt Set Mocha'],
  ['/produtos?colecao=Move&cor=Black', 200, 'STUW Move Zip Set'],
  ['/produtos?categoria=Activewear%20%2F%20Running', 200, 'STUW Active Run Set'],
  ['/produtos?categoria=Conjuntos', 200, 'STUW Mocha Sculpt Set'],
  ['/produtos/nao-existe', 404, 'Essa página não está por aqui.'],
  ['/checkout', 200, 'Fazer login'],
  ['/checkout/information', 200, 'Fazer login'],
  ['/checkout/shipping', 200, 'Fazer login'],
  ['/checkout/payment', 200, 'Fazer login'],
  ['/admin/pedidos/00000000-0000-0000-0000-000000000001', 200, 'Fazer login'],
  ['/conta/compras/00000000-0000-0000-0000-000000000001', 200, 'Fazer login'],
  ['/products/legging-sculpt-frente.jpg', 200, null],
  ['/products/legging-sculpt-costas.png', 200, null],
  ['/products/STUW-Mocha%20Sculpt-Set-frente.png', 200, null],
  ['/products/STUW-Mocha-Sculpt-Set-costas.png', 200, null],
  ['/products/STUW_Run_Set-Mauve-frente.png', 200, null],
  ['/products/STUW_Run_Set-Mauve-costas.png', 200, null],
];
(async () => {
  for (const [route, status, text] of cases) {
    const response = await fetch(base + route);
    assert.equal(response.status, status, route);
    if (text) {
      const html = await response.text();
      assert.ok(html.includes(text), `Missing content: ${route}`);
      if (route === '/produtos/stuw-mocha-sculpt-set') {
        const gallery = html.match(
          /<section aria-label="Galeria de STUW Mocha Sculpt Set"[\s\S]*?<\/section>/,
        )?.[0];
        assert.ok(gallery, 'Mocha product gallery must be rendered');
        assert.equal((gallery.match(/aria-label="Ver imagem /g) ?? []).length, 2);
        assert.ok(gallery.includes('STUW-Mocha%20Sculpt-Set-frente.png'));
        assert.ok(gallery.includes('STUW-Mocha-Sculpt-Set-costas.png'));
        assert.ok(!gallery.includes('fabric-macro'), 'Mocha gallery must not show generic texture');
      }
    }
    console.log(`OK ${status} ${route}`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
