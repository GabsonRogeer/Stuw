import Link from 'next/link';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { confirmInventoryMovement } from './actions';
import { OlistInvoiceForm } from '@/components/admin/OlistInvoiceForm';
export default async function OlistPage() {
  const { supabase } = await requireAdminPage();
  // This dynamic server page evaluates freshness once for the authenticated request.
  // eslint-disable-next-line react-hooks/purity
  const staleBefore = Date.now() - 600_000;
  const [products, inbox, skuWarnings, inventory, invoiceJobs, automation] = await Promise.all([
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
    supabase
      .from('olist_invoice_jobs')
      .select('*')
      .eq('automatic', true)
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase.from('olist_invoice_automation').select('*').eq('id', true).single(),
  ]);
  const fiscalOrders = invoiceJobs.data?.length
    ? await supabase
        .from('orders')
        .select('id,number')
        .in(
          'id',
          invoiceJobs.data.map((j) => j.order_id),
        )
    : null;
  const labels: Record<string, string> = {
    pending: 'Aguardando',
    linked: 'Vinculado',
    blocked: 'Pendência',
    uncertain: 'Conferir na Olist',
    conflict: 'Revisar alterações',
    imported: 'Importado',
    generated: 'NF gerada · aguardando emissão',
    processing: 'Aguardando autorização fiscal',
    authorized: 'NF autorizada',
    ignored: 'Fora da categoria Stuw ou variação do produto pai',
  };
  return (
    <div className="space-y-6">
      <h2 className="font-serif text-3xl">Integração Olist</h2>
      <p className="text-sm">
        Somente produtos da categoria Stuw e suas subcategorias entram como rascunho. Confira fotos,
        textos, grade e dados fiscais antes de publicar.
      </p>
      <section className="border rounded p-4 space-y-3">
        <h3 className="font-medium">Faturamento automático</h3>
        {automation.error || invoiceJobs.error || fiscalOrders?.error ? (
          <p role="alert">Não foi possível consultar a fila fiscal.</p>
        ) : (
          <>
            <p className="text-sm">
              {automation.data?.enabled
                ? 'Ativo para novos pedidos reais com pagamento aprovado e vínculo na Olist.'
                : 'Aguardando ativação operacional.'}{' '}
              A autorização fiscal é confirmada antes de disponibilizar e enviar a NF.
            </p>
            {invoiceJobs.data?.map((job) => (
              <div key={job.order_id} className="border rounded p-3 text-sm space-y-1">
                <p className="font-medium">
                  {fiscalOrders?.data?.find((o) => o.id === job.order_id)?.number ?? job.order_id}
                </p>
                <p>
                  {labels[job.status] ?? job.status}
                  {job.invoice_id ? ` · NF Olist ${job.invoice_id}` : ''}
                </p>
                {job.last_error && <p role="alert">{job.last_error}</p>}
                {job.document_error && <p role="alert">{job.document_error}</p>}
                {job.status === 'blocked' && (
                  <p>
                    Corrija na Olist e use a operação de retomada abaixo com o ID {job.order_id}.
                  </p>
                )}
              </div>
            ))}
            {!invoiceJobs.data?.length && (
              <p className="text-sm">Nenhum pedido na fila automática.</p>
            )}
          </>
        )}
      </section>
      <details className="border rounded p-4">
        <summary>Faturamento de pedidos reais</summary>
        <p className="text-sm my-4">
          Use para consultar ou revisar pendências. Na retomada, tentativas de geração ou emissão já
          registradas serão apenas consultadas, sem repetir solicitações fiscais. Pedidos anteriores
          à ativação continuam disponíveis para tratamento manual.
        </p>
        <OlistInvoiceForm />
      </details>
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
