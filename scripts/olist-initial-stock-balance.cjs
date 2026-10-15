// One-time correction of the physical count explicitly confirmed by the owner.
const { loadEnvConfig } = require('@next/env');
const { loadTypeScript } = require('./lib/load-typescript.cjs');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const { olistRequest } = loadTypeScript('src/lib/integrations/olist.ts', { 'server-only': {} });
async function main() {
  const id = '363800484';
  const sku = 'STUW-SHORT-AZUL-M';
  const before = (await olistRequest('produto.obter.estoque.php', { id })).produto;
  if (before?.codigo !== sku || Number(before.saldoReservado ?? 0) !== 0) throw Error();
  if (Number(before.saldo) === 5) {
    console.log('Physical balance already 5; no write.');
    return;
  }
  if (Number(before.saldo) !== 3) throw Error();
  const r = await fetch('https://api.tiny.com.br/api2/produto.atualizar.estoque.php', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({
      token: process.env.OLIST_API_TOKEN,
      formato: 'JSON',
      estoque: JSON.stringify({
        estoque: {
          idProduto: id,
          tipo: 'B',
          quantidade: 5,
          deposito: 'Geral',
          observacoes: 'Contagem fisica confirmada: 5. Duas reservas de teste permanecem no site.',
        },
      }),
    }),
  });
  const result = (await r.json()).retorno;
  console.log(
    JSON.stringify({
      status: result?.status,
      records: result?.registros?.map((x) => ({
        id: x.registro?.id,
        status: x.registro?.status,
        balance: x.registro?.saldoEstoque,
      })),
    }),
  );
  if (!r.ok || result?.status !== 'OK') throw Error();
  const after = (await olistRequest('produto.obter.estoque.php', { id })).produto;
  console.log(
    JSON.stringify({ sku: after?.codigo, physical: after?.saldo, reserved: after?.saldoReservado }),
  );
  if (Number(after?.saldo) !== 5) throw Error();
}
main().catch(() => {
  console.error('Balance not confirmed; inspect ERP before another write.');
  process.exitCode = 1;
});
