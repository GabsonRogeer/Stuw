const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const { emptyProduct, validateProduct } = loadTypeScript('src/services/product-admin.ts');
const { toOlistSku, fromOlistProduct, productExportIssues, isStuwProduct } = loadTypeScript(
  'src/services/olist-catalog.ts',
);

function product() {
  return {
    id: 1000000,
    document: {
      ...emptyProduct(),
      name: 'Top Azul',
      slug: 'top-azul',
      origin: '0',
      price: 100,
      weight: 300,
      description: 'Descrição STUW',
      colors: [
        {
          name: 'Azul',
          slug: 'azul',
          hex: '#0000ff',
          swatch: '',
          active: true,
          price: null,
          images: [{ src: '/products/top.webp', alt: 'Top', role: 'frente' }],
          skus: [
            { size: 'P', code: 'STUW-TOP-AZUL-P', gtin: '', stock: 5, price: 90, active: true },
          ],
        },
      ],
    },
  };
}
test('catalog exports a standalone SKU with opening balance and fiscal origin zero', () => {
  const value = toOlistSku(product(), 'STUW-TOP-AZUL-P', 'https://stuw.com.br');
  assert.equal(value.origem, '0');
  assert.equal(value.categoria, 'Stuw');
  assert.equal(value.peso_bruto, 0.3);
  assert.equal(value.preco, '90.00');
  assert.equal(value.classe_produto, 'S');
  assert.equal(value.nome, 'Top Azul P');
  assert.equal(value.variacoes, undefined);
  assert.equal(
    value.imagens_externas[0].imagem_externa.url,
    'https://stuw.com.br/products/top.webp',
  );
  assert.equal(value.estoque_atual, 5);
});
test('missing fiscal origin and incompatible SKUs block export', () => {
  const value = product();
  value.document.origin = '';
  value.document.colors[0].skus[0].code = 'SKU COM ESPACO';
  assert.equal(productExportIssues(value).length, 2);
  assert.throws(() => toOlistSku(value, 'STUW-TOP-AZUL-P', 'https://stuw.com.br'));
});
test('Olist descriptions and grade import as unpublished drafts with no invented inventory', () => {
  const value = fromOlistProduct({
    id: '123',
    nome: 'Top Azul',
    codigo: 'STUW-TOP-AZUL-P',
    tipoVariacao: 'N',
    origem: '0',
    ncm: '6109.10.00',
    unidade: 'UN',
    preco: '100',
    descricao_complementar: '<p>Poliamida<br>Cuidados</p><script>alert(1)</script>',
  });
  assert.equal(value.status, 'draft');
  assert.equal(value.origin, '0');
  assert.equal(value.ncm, '61091000');
  assert.equal(value.description, 'Poliamida\nCuidados');
  assert.equal(value.colors[0].skus[0].stock, 0);
  assert.equal(validateProduct(value), null);
});
test('unsupported ERP identifiers and duplicate grade require review', () => {
  assert.throws(() => fromOlistProduct({ id: '123', nome: 'Top', codigo: 'COM ESPACO' }), /SKU/);
  assert.throws(
    () => fromOlistProduct({ id: '123', nome: 'Pai', codigo: 'PAI', classe_produto: 'V' }),
    /incompatível/,
  );
});
test('kits reference existing component IDs and never get independent stock or variations', () => {
  const p = product();
  p.document.colors[0].skus[0].components = [
    { sku: 'TOP-P', quantity: 1 },
    { sku: 'SHORT-P', quantity: 1 },
  ];
  assert.throws(() => toOlistSku(p, 'STUW-TOP-AZUL-P', 'https://stuw.com.br'), /componentes/);
  const value = toOlistSku(p, 'STUW-TOP-AZUL-P', 'https://stuw.com.br', [
    { sku: 'TOP-P', remote_id: '12' },
    { sku: 'SHORT-P', remote_id: '13' },
  ]);
  assert.equal(value.classe_produto, 'K');
  assert.equal(value.estoque_atual, undefined);
  assert.equal(value.variacoes, undefined);
  assert.deepEqual(value.kit, [
    { item: { id_produto: '12', quantidade: 1 } },
    { item: { id_produto: '13', quantidade: 1 } },
  ]);
});
test('only the Stuw category tree is eligible for import', () => {
  for (const categoria of ['Stuw', 'STUW', ' Stuw >> Tops '])
    assert.equal(isStuwProduct({ categoria }), true);
  for (const categoria of [undefined, '', 'Outros', 'Stuw Outlet', 'Outros >> Stuw'])
    assert.equal(isStuwProduct({ categoria }), false);
});
