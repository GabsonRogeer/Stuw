import Link from 'next/link';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { confirmInventoryMovement } from './actions';
export default async function OlistPage() {
  const { supabase } = await requireAdminPage();
  // This dynamic server page evaluates freshness once for the authenticated request.
  // eslint-disable-next-line react-hooks/purity
  const staleBefore = Date.now() - 600_000;
  const [products, inbox, skuWarnings, inventory] = await Promise.all([
    supabase
      .from('olist_products')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase.from('olist_inbox').select('*').order('updated_at', { ascending: false }).limit(100),
    supabase
      .from('olist_skus')
      .select('sku,remote_id,last_error')
      .not('last_error', 'is', null)
      .order('sku')
      .limit(100),
    supabase.from('olist_inventory').select('*').order('sku').limit(200),
  ]);
  const labels: Record<string, string> = {
    pending: 'Aguardando',
    linked: 'Vinculado',
    blocked: 'Pendência',
    uncertain: 'Conferir na Olist',
    conflict: 'Revisar alterações',
    imported: 'Importado',
    ignored: 'Fora da categoria Stuw ou variação do produto pai',
  };
  return (
    <div className="space-y-6">
      <h2 className="font-serif text-3xl">Integração Olist</h2>
      <p className="text-sm">
        Somente produtos da categoria Stuw e suas subcategorias entram como rascunho. Confira fotos,
        textos, grade e dados fiscais antes de publicar.
      </p>
      {products.error || inbox.error || skuWarnings.error || inventory.error ? (
        <p role="alert">
          A integração ainda não está disponível. Confira a configuração do servidor.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="font-medium">Estoque Olist · até 200 SKUs</h3>
            <p className="text-sm">
              Observação registra os saldos sem alterar a loja. Conjuntos seguem o saldo dos
              componentes.
            </p>
            {inventory.data.map((row) => (
              <div key={row.sku} className="border rounded p-4 text-sm">
                <p>
                  {row.sku} · {row.enabled ? 'Conciliação ativa' : 'Observação'}
                </p>
                <p>
                  Físico: {row.physical ?? '—'} · Reservado na Olist: {row.reserved ?? '—'}
                </p>
                <p>
                  Última leitura:{' '}
                  {row.observed_at
                    ? new Date(row.observed_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })
                    : 'Ainda não consultado'}
                </p>
                {(!row.observed_at || Date.parse(row.observed_at) < staleBefore) && (
                  <p role="alert">Leitura ausente ou atrasada.</p>
                )}
                {row.error && <p role="alert">{row.error}</p>}
              </div>
            ))}
          </section>
          <details className="border rounded p-4 text-sm">
            <summary>Confirmar baixa automática de um pedido na Olist</summary>
            <p className="my-3">
              Use somente após conferir o movimento de saída no estoque da Olist. Pagamento aprovado
              ou nota emitida, isoladamente, não comprovam a baixa. A confirmação solicita uma nova
              leitura dos saldos.
            </p>
            <form action={confirmInventoryMovement} className="space-y-3">
              <label className="block">
                ID do pedido no site
                <input name="orderId" required className="block border rounded p-2 w-full" />
              </label>
              <label className="block">
                Referência do movimento conferido
                <input
                  name="proof"
                  required
                  minLength={10}
                  maxLength={400}
                  className="block border rounded p-2 w-full"
                />
              </label>
              <label className="block">
                <input type="checkbox" name="verified" required /> Conferi a baixa dos componentes e
                a liberação da reserva desse pedido na Olist.
              </label>
              <button className="border rounded px-4 py-2" type="submit">
                Registrar conferência
              </button>
            </form>
          </details>
          {skuWarnings.data.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-medium">Pendências por SKU · até 100 registros</h3>
              {skuWarnings.data.map((sku) => (
                <div key={sku.sku} className="border rounded p-4 text-sm">
                  <p>
                    {sku.sku}
                    {sku.remote_id ? ` · Olist ${sku.remote_id}` : ''}
                  </p>
                  <p className="mt-2">{sku.last_error}</p>
                </div>
              ))}
            </section>
          )}
          <h3 className="font-medium">Produtos do site · últimos 100 registros</h3>
          <div className="space-y-3">
            {products.data.map((p) => (
              <div key={p.product_id} className="border rounded p-4 text-sm">
                <Link className="underline" href={`/admin/produtos/${p.product_id}`}>
                  Produto {p.product_id}
                </Link>
                <p>
                  {labels[p.state] ?? p.state}
                  {p.remote_id ? ` · Olist ${p.remote_id}` : ''}
                </p>
                {p.last_error && <p className="mt-2">{p.last_error}</p>}
              </div>
            ))}
          </div>
          <h3 className="font-medium">Recebidos da Olist · últimos 100 registros</h3>
          <div className="space-y-3">
            {inbox.data.map((p) => (
              <div key={p.remote_id} className="border rounded p-4 text-sm">
                <p>
                  {p.name} · {labels[p.state] ?? p.state}
                </p>
                {p.last_error && <p className="mt-2">{p.last_error}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
