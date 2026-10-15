import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOperationPage } from '@/lib/supabase/operations-page';
import { isUuid } from '@/services/orders';
import {
  OPERATION_STAGES,
  RETURN_STAGES,
  RETURN_NEXT,
  localTime,
  money,
} from '@/services/operations';
import { PAYMENT_LABELS, SHIPMENT_LABELS } from '@/services/fulfillment';
import { OperationalForm } from '@/components/admin/OperationalForm';

export default async function OperationalOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase: db } = await requireOperationPage();
  const [order, operation, returns, finance, fulfill, canReturn] = await Promise.all([
    db.from('orders').select('*').eq('id', id).maybeSingle(),
    db.from('operation_orders').select('*').eq('order_id', id).maybeSingle(),
    db
      .from('order_returns')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false }),
    db.rpc('operation_allowed', { permission: 'finance' }),
    db.rpc('operation_allowed', { permission: 'fulfill' }),
    db.rpc('operation_allowed', { permission: 'returns' }),
  ]);
  if (order.error || operation.error || returns.error)
    return <p role="alert">Não foi possível carregar o pedido.</p>;
  if (!order.data) notFound();
  const o = order.data;
  const [people, history] = await Promise.all([
    db.rpc('operation_people'),
    db
      .from('operation_audit')
      .select('*')
      .eq('order_id', id)
      .order('id', { ascending: false })
      .limit(100),
  ]);
  const names = new Map(people.data?.map((p) => [p.user_id, p.full_name]));
  const person = (actor: string | null) =>
    actor ? names.get(actor) || actor : 'Integração / sistema';
  const refunds = finance.data
    ? await db.from('order_refunds').select('*').eq('order_id', id).order('cumulative_cents')
    : null;
  const totalRefunded = refunds?.data?.reduce((sum, r) => sum + r.amount_cents, 0) ?? 0;
  const stage = operation.data?.stage ?? 'awaiting_pick';
  const stages = Object.keys(OPERATION_STAGES);
  const options = stages.slice(stages.indexOf(stage), stages.indexOf(stage) + 2);
  const note = (
    <label className="block text-sm">
      Observação / comprovante
      <textarea name="note" className="field" required minLength={5} maxLength={500} />
    </label>
  );
  return (
    <div className="space-y-8">
      <Link className="underline text-sm" href="/operacao">
        Voltar aos pedidos
      </Link>
      <section className="space-y-2">
        <h2 className="font-serif text-3xl">Pedido {o.number}</h2>
        <p>
          {o.customer_name} · {money(o.total_cents)}
          {(o.is_demo || o.payment_test_mode) && ' · PEDIDO DE TESTE'}
        </p>
        <p>
          {PAYMENT_LABELS[o.payment_status]} · {SHIPMENT_LABELS[o.shipment_status]}
        </p>
        <p>Rastreio: {o.tracking_code || 'Ainda não informado'}</p>
        <p className="text-sm">{Object.values(o.delivery).filter(Boolean).join(' · ')}</p>
        <ul>
          {o.items.map((item, index) => (
            <li key={index}>
              {item.qty} × {item.title} · {item.color} · {item.size} · {item.sku}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-4 rounded border p-5">
        <h3 className="font-serif text-2xl">Preparação: {OPERATION_STAGES[stage]}</h3>
        <p className="text-sm">
          Responsável:{' '}
          {operation.data?.responsible_id
            ? person(operation.data.responsible_id)
            : 'Ainda não assumido'}
        </p>
        {operation.data && (
          <p className="text-sm">
            {localTime(operation.data.updated_at)} · {operation.data.evidence}
          </p>
        )}
        {fulfill.data && (
          <OperationalForm
            key={operation.data?.revision ?? 0}
            fields={{ action: 'stage', order: id, revision: operation.data?.revision ?? 0 }}
            label="Assumir e registrar etapa"
          >
            <label className="block">
              Etapa
              <select name="stage" className="field" defaultValue={stage}>
                {options.map((s) => (
                  <option key={s} value={s}>
                    {OPERATION_STAGES[s]}
                  </option>
                ))}
              </select>
            </label>
            {note}
          </OperationalForm>
        )}
        <p className="text-sm">
          Faturamento exige nota vinculada na Olist. Postagem exige confirmação de envio e rastreio.
          Registrar uma etapa atribui a responsabilidade à sua conta.
        </p>
      </section>
      {finance.data && (
        <section className="space-y-4 rounded border p-5">
          <h3 className="font-serif text-2xl">Reembolsos</h3>
          {refunds?.error ? (
            <p role="alert">Não foi possível carregar os valores.</p>
          ) : (
            <>
              <p>
                Confirmado: {money(totalRefunded)} ·{' '}
                {totalRefunded === 0
                  ? 'Sem reembolso registrado'
                  : totalRefunded < o.total_cents
                    ? 'Reembolso parcial'
                    : 'Reembolso total'}
              </p>
              {refunds?.data?.map((r) => (
                <p key={r.id} className="text-sm">
                  {localTime(r.provider_time)} · {money(r.amount_cents)} · Acumulado{' '}
                  {money(r.cumulative_cents)} · Pagamento {r.payment_id}
                </p>
              ))}
            </>
          )}
          <p className="text-sm">
            Valores conciliados com o Mercado Pago. Uma atualização pode reunir mais de um estorno
            ocorrido entre consultas. Solicite o reembolso no provedor e atualize a conciliação
            aqui.
          </p>
          <OperationalForm
            fields={{ action: 'payment', order: id }}
            label="Consultar pagamento e reembolsos"
          />
        </section>
      )}
      <section className="space-y-5">
        <h3 className="font-serif text-2xl">Trocas e devoluções por item</h3>
        <p className="text-sm">
          O recebimento não libera estoque automaticamente. Após conferir a peça, registre na Olist
          a destinação física e informe os comprovantes do reembolso ou do pedido de troca ao
          concluir.
        </p>
        {canReturn.data && (
          <details className="border rounded p-5">
            <summary>Nova solicitação</summary>
            <div className="pt-4">
              <OperationalForm
                fields={{
                  action: 'return',
                  order: id,
                  revision: 0,
                  key: randomUUID(),
                  stage: 'requested',
                }}
                label="Registrar solicitação"
              >
                <label className="block">
                  Item
                  <select name="item" className="field">
                    {o.items.map((i, index) => (
                      <option key={index} value={index}>
                        {i.title} · {i.color} · {i.size} (comprado: {i.qty})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  Quantidade
                  <input
                    type="number"
                    name="quantity"
                    min={1}
                    max={99}
                    defaultValue={1}
                    required
                    className="field"
                  />
                </label>
                <label className="block">
                  Tipo
                  <select name="kind" className="field">
                    <option value="return">Devolução</option>
                    <option value="exchange">Troca</option>
                  </select>
                </label>
                {note}
              </OperationalForm>
            </div>
          </details>
        )}
        {returns.data.map((r) => (
          <article key={r.id} className="border rounded p-5 space-y-3">
            <h4 className="font-medium">
              {r.kind === 'exchange' ? 'Troca' : 'Devolução'} · {RETURN_STAGES[r.status]}
            </h4>
            <p>
              {r.quantity} × {o.items[r.item_index]?.title} · {o.items[r.item_index]?.color} ·{' '}
              {o.items[r.item_index]?.size}
            </p>
            <p>{r.reason}</p>
            <p className="text-sm">
              {r.resolution} · Responsável {person(r.responsible_id)} · {localTime(r.updated_at)}
            </p>
            {r.inspection && (
              <p className="text-sm">
                Conferência:{' '}
                {r.inspection === 'resalable' ? 'Peça apta para venda' : 'Peça danificada'} ·{' '}
                {r.stock_disposition === 'no_restock'
                  ? 'Sem retorno ao estoque vendável'
                  : r.stock_disposition === 'olist_recorded'
                    ? 'Movimento registrado na Olist'
                    : 'Destinação pendente'}{' '}
                · {r.stock_reference} · {r.settlement_reference}
              </p>
            )}
            {canReturn.data && RETURN_NEXT[r.status]?.length > 0 && (
              <OperationalForm
                key={r.revision}
                fields={{
                  action: 'return',
                  order: id,
                  return_id: r.id,
                  key: r.request_key,
                  item: r.item_index,
                  quantity: r.quantity,
                  kind: r.kind,
                  revision: r.revision,
                }}
                label="Atualizar solicitação"
              >
                <label className="block">
                  Próxima etapa
                  <select name="stage" className="field">
                    {RETURN_NEXT[r.status].map((s) => (
                      <option key={s} value={s}>
                        {RETURN_STAGES[s]}
                      </option>
                    ))}
                  </select>
                </label>
                {note}
                {r.status === 'received' && (
                  <label className="block">
                    Condição da peça
                    <select name="inspection" className="field" required>
                      <option value="">Selecione</option>
                      <option value="resalable">Apta para venda</option>
                      <option value="damaged">Danificada</option>
                    </select>
                  </label>
                )}
                {r.status === 'inspected' && (
                  <>
                    <label className="block">
                      Destinação do estoque
                      <select name="stock_disposition" className="field" required>
                        <option value="">Selecione</option>
                        <option value="no_restock">Não retornar ao estoque vendável</option>
                        {r.inspection === 'resalable' && (
                          <option value="olist_recorded">Entrada já registrada na Olist</option>
                        )}
                      </select>
                    </label>
                    <label className="block">
                      Referência do movimento na Olist (se houve entrada)
                      <input name="stock_reference" className="field" maxLength={200} />
                    </label>
                    <label className="block">
                      {r.kind === 'exchange'
                        ? 'Referência do novo pedido / envio da troca'
                        : 'Comprovante do reembolso ou justificativa da resolução'}
                      <input
                        name="settlement_reference"
                        className="field"
                        required
                        minLength={5}
                        maxLength={200}
                      />
                    </label>
                  </>
                )}
              </OperationalForm>
            )}
          </article>
        ))}
        {!returns.data.length && <p>Nenhuma solicitação registrada.</p>}
      </section>
      <section className="space-y-3">
        <h3 className="font-serif text-2xl">Histórico operacional</h3>
        {history.error ? (
          <p role="alert">Histórico indisponível.</p>
        ) : (
          history.data.map((e) => (
            <article key={e.id} className="border-t pt-3 text-sm">
              <p>
                {localTime(e.created_at)} · {person(e.actor_id)}
              </p>
              <p>
                {e.entity === 'operation_orders'
                  ? `Preparação: ${OPERATION_STAGES[String(e.after_data.stage)] ?? e.after_data.stage}`
                  : e.entity === 'order_returns'
                    ? `Troca/devolução: ${RETURN_STAGES[String(e.after_data.status)] ?? e.after_data.status}`
                    : 'Reembolso conciliado'}
              </p>
              <p>
                {String(
                  e.after_data.evidence ?? e.after_data.resolution ?? e.after_data.reason ?? '',
                )}
              </p>
            </article>
          ))
        )}
        <p className="text-xs">Até 100 eventos mais recentes, conforme suas permissões.</p>
      </section>
    </div>
  );
}
