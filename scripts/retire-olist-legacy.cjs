// Retire only the one variant parent created before the user chose standalone SKUs.
const { loadEnvConfig } = require('@next/env');
const { loadTypeScript } = require('./lib/load-typescript.cjs');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const { getOlistProduct, olistRequest } = loadTypeScript('src/lib/integrations/olist.ts', {
  'server-only': {},
});
async function main() {
  if (process.env.OLIST_ENABLED !== 'true') throw Error();
  const p = await getOlistProduct('363782837');
  if (p.codigo === 'OLD-STUW-MODELO-1000002' && p.situacao === 'I') {
    console.log('Legacy parent already inactive.');
    return;
  }
  if (
    p.codigo !== 'STUW-MODELO-1000002' ||
    p.variacoes?.length !== 3 ||
    p.variacoes.some(
      (v) =>
        !['STUW-CONJ-AZUL-P', 'STUW-CONJ-AZUL-M', 'STUW-CONJ-AZUL-G'].includes(v.variacao.codigo),
    )
  )
    throw Error();
  const produto = {
    sequencia: 1,
    id: p.id,
    codigo: 'OLD-STUW-MODELO-1000002',
    nome: p.nome,
    unidade: p.unidade,
    preco: p.preco,
    origem: p.origem,
    situacao: 'I',
    tipo: p.tipo,
    classe_produto: 'V',
    marca: p.marca,
    ncm: p.ncm,
    cest: p.cest,
    descricao_complementar: p.descricao_complementar,
    peso_bruto: p.peso_bruto,
    altura_embalagem: p.alturaEmbalagem,
    largura_embalagem: p.larguraEmbalagem,
    comprimento_embalagem: p.comprimentoEmbalagem,
    imagens_externas: p.imagens_externas,
    anexos: p.anexos,
    categoria: 'Stuw',
    variacoes: p.variacoes.map((v) => ({
      variacao: { ...v.variacao, codigo: 'OLD-' + v.variacao.codigo },
    })),
  };
  const result = await olistRequest('produto.alterar.php', {
    produto: JSON.stringify({ produtos: [{ produto }] }),
  });
  if (result.registros?.[0]?.registro.status !== 'OK') throw Error();
  const after = await getOlistProduct(p.id);
  if (
    after.situacao !== 'I' ||
    after.codigo !== produto.codigo ||
    after.variacoes?.some((v) => !v.variacao.codigo.startsWith('OLD-'))
  )
    throw Error();
  console.log(
    JSON.stringify({
      id: after.id,
      status: after.situacao,
      category: after.categoria,
      legacySkus: after.variacoes.map((v) => v.variacao.codigo),
    }),
  );
}
main().catch(() => {
  console.error('Retirement not confirmed; inspect the existing product before retrying.');
  process.exitCode = 1;
});
