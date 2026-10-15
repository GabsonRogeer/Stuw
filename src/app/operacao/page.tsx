import Link from 'next/link';
import { requireOperationPage } from '@/lib/supabase/operations-page';
import { OperationalForm } from '@/components/admin/OperationalForm';
import { OPERATION_STAGES, STAFF_ROLES, localTime, money } from '@/services/operations';
import { PAYMENT_LABELS } from '@/services/fulfillment';
import { ArrowUpRight, PackageCheck, ShoppingBag } from 'lucide-react';
import { OrderListFilters } from '@/components/admin/OrderListFilters';
import { orderFilters } from '@/services/order-filters';

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    page?: string;
    sku?: string;
    q?: string;
    status?: string;
    mode?: string;
  }>;
}) {
  const params = await searchParams;
  const view = ['stock', 'audit', 'team'].includes(params.view ?? '') ? params.view! : 'orders';
  const session = await requireOperationPage();
  const allowed = await session.supabase.rpc('operation_allowed', { permission: view });
  if (!allowed.data) return <p>Seu perfil não permite acessar esta área.</p>;
  const db = session.supabase;
  const people = await db.rpc('operation_people');
  const names = new Map(people.data?.map((p) => [p.user_id, p.full_name]));
  const person = (id: string | null) => (id ? names.get(id) || id : 'Integração / sistema');
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const start = (Math.floor(page) - 1) * 50;
  const next = (
    <div className="ops-pagination">
      <span className="mr-auto text-stuw-slate">Página {Math.floor(page)}</span>
      {page > 1 && (
        <Link href={`?view=${view}&page=${page - 1}&sku=${encodeURIComponent(params.sku ?? '')}`}>
          Anterior
        </Link>
      )}
      <Link href={`?view=${view}&page=${page + 1}&sku=${encodeURIComponent(params.sku ?? '')}`}>
        Próxima página
      </Link>
    </div>
  );
  if (view === 'team') {
    const team = await db
      .from('operation_staff')
      .select('*')
      .order('updated_at', { ascending: false })
      .range(start, start + 49);
    if (team.error) return <p role="alert">Não foi possível carregar a equipe.</p>;
    return (
      <section className="space-y-6">
        <h2 className="font-serif text-2xl">Perfis de acesso</h2>
        <p>
          Expedição: preparação, devoluções e estoque. Atendimento: devoluções. Financeiro:
          conciliação de reembolsos. Auditoria: consulta de estoque e histórico. Todos consultam
          pedidos.
        </p>
        <OperationalForm fields={{ action: 'staff' }} label="Atualizar acesso">
          <label className="block">
            E-mail do colaborador
            <input name="email" type="email" className="field" maxLength={254} required />
          </label>
          <label className="block">
            Perfil
            <select name="role" className="field">
              {Object.entries(STAFF_ROLES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Acesso
            <select name="active" className="field">
              <option value="true">Ativo</option>
              <option value="false">Revogado</option>
            </select>
          </label>
        </OperationalForm>
        <p className="text-sm">
          A conta deve existir. Este cadastro não concede acesso ao catálogo nem substitui
          administradores existentes.
        </p>
        <ul className="space-y-2">
          {team.data.map((s) => (
            <li key={s.user_id} className="break-all">
              {person(s.user_id)} · {STAFF_ROLES[s.role]} · {s.active ? 'Ativo' : 'Revogado'}
            </li>
          ))}
        </ul>
        {next}
      </section>
    );
  }
  if (view === 'stock') {
    let query = db
      .from('stock_movements')
      .select('*')
      .order('id', { ascending: false })
      .range(start, start + 49);
    if (params.sku) query = query.eq('sku', params.sku.slice(0, 100));
    const movements = await query;
    if (movements.error) return <p role="alert">Não foi possível carregar o extrato.</p>;
    return (
      <section className="space-y-5">
        <h2 className="font-serif text-2xl">Extrato de estoque</h2>
        <p>
          Reservas e conciliação alteram a disponibilidade do site. O saldo físico é controlado na
          Olist; os conjuntos são calculados a partir das peças.
        </p>
        <form className="flex gap-3">
          <input type="hidden" name="view" value="stock" />
          <input
            aria-label="SKU exato"
            name="sku"
            placeholder="Filtrar por SKU exato"
            defaultValue={params.sku}
            className="field"
          />
          <button>Filtrar</button>
        </form>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Data', 'SKU', 'Saldo', 'Variação', 'Tipo / motivo', 'Responsável', 'Pedido'].map(
                  (t) => (
                    <th className="p-3 text-left" key={t}>
                      {t}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {movements.data.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3">{localTime(m.created_at)}</td>
                  <td>{m.sku}</td>
                  <td>
                    {m.stock_before} → {m.stock_after}
                  </td>
                  <td>
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </td>
                  <td>
                    {{
                      reservation: 'Reserva no site',
                      payment_reconciliation: 'Conciliação de pagamento',
                      olist_reconciliation: 'Disponível no site',
                      olist_physical: 'Físico na Olist',
                      olist_reserved: 'Reservado na Olist',
                      derived_kit: 'Conjunto calculado',
                      catalog_adjustment: 'Ajuste de cadastro',
                    }[m.kind] ?? m.kind}
                    <br />
                    {m.reason}
                  </td>
                  <td>{person(m.actor_id)}</td>
                  <td>
                    {m.order_id && (
                      <Link className="underline" href={`/operacao/pedidos/${m.order_id}`}>
                        Ver pedido
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!movements.data.length && <p>Nenhuma movimentação registrada neste filtro.</p>}
        {next}
      </section>
    );
  }
  if (view === 'audit') {
    const audit = await db
      .from('operation_audit')
      .select('*')
      .order('id', { ascending: false })
      .range(start, start + 49);
    if (audit.error) return <p role="alert">Não foi possível carregar a auditoria.</p>;
    return (
      <section className="space-y-5">
        <h2 className="font-serif text-2xl">Histórico de operações</h2>
        {audit.data.map((e) => (
          <details key={e.id} className="border rounded p-4">
            <summary>
              {localTime(e.created_at)} ·{' '}
              {{
                operation_orders: 'Preparação do pedido',
                order_returns: 'Troca / devolução',
                order_refunds: 'Reembolso',
                operation_staff: 'Permissões da equipe',
              }[e.entity] ?? e.entity}{' '}
              · {e.action === 'INSERT' ? 'Registro criado' : 'Registro atualizado'} ·{' '}
              {person(e.actor_id)}
            </summary>
            <pre className="overflow-auto text-xs mt-3">
              {JSON.stringify({ antes: e.before_data, depois: e.after_data }, null, 2)}
            </pre>
          </details>
        ))}
        {!audit.data.length && <p>Nenhum evento registrado.</p>}
        {next}
      </section>
    );
  }
  const filters = orderFilters(params);
  let orderQuery = db.from('orders').select('*', { count: 'exact' });
  if (filters.status) orderQuery = orderQuery.eq('status', filters.status);
  if (filters.mode === 'demo') orderQuery = orderQuery.eq('is_demo', true);
  if (filters.mode === 'sandbox')
    orderQuery = orderQuery.eq('is_demo', false).eq('payment_test_mode', true);
  if (filters.mode === 'live')
    orderQuery = orderQuery.eq('is_demo', false).eq('payment_test_mode', false);
  if (filters.q)
    orderQuery = orderQuery.or(
      `number.ilike.%${filters.q}%,customer_name.ilike.%${filters.q}%,customer_email.ilike.%${filters.q}%`,
    );
  const orders = await orderQuery
    .order('created_at', { ascending: false })
    .order('id')
    .range(start, start + 49);
  if (orders.error) return <p role="alert">Não foi possível carregar os pedidos.</p>;
  const operations = orders.data.length
    ? await db
        .from('operation_orders')
        .select('*')
        .in(
          'order_id',
          orders.data.map((o) => o.id),
        )
    : { data: [], error: null };
  if (operations.error) return <p role="alert">Não foi possível carregar as etapas.</p>;
  const stages = new Map(operations.data.map((o) => [o.order_id, o.stage]));
  const orderPageHref = (target: number) =>
    '/operacao?' + new URLSearchParams({ ...filters, page: String(target) });
  const preparing = orders.data.filter(
    (o) =>
      o.payment_status === 'approved' &&
      !['shipped', 'in_transit', 'delivered'].includes(o.shipment_status),
  ).length;
  const sent = orders.data.filter((o) =>
    ['shipped', 'in_transit', 'delivered'].includes(o.shipment_status),
  ).length;
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl">Seus pedidos</h2>
          <p className="text-sm text-stuw-slate mt-1">
            Uma visão clara do que precisa da sua atenção.
          </p>
        </div>
        <ShoppingBag className="text-stuw-sage shrink-0" size={22} aria-hidden="true" />
      </div>
      <OrderListFilters basePath="/operacao" {...filters} />
      <p className="text-xs text-stuw-slate">{orders.count ?? 0} pedido(s) encontrado(s)</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Pedidos nesta página', orders.data.length],
          ['A preparar nesta página', preparing],
          ['Envios confirmados nesta página', sent],
        ].map(([label, count]) => (
          <div className="ops-stat" key={label}>
            <span className="text-xs text-stuw-slate">{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs font-medium uppercase tracking-widest text-stuw-slate">
          Mais recentes primeiro
        </p>
        <span className="text-xs text-stuw-slate">Até 50 por página</span>
      </div>
      {orders.data.map((o) => (
        <Link key={o.id} className="ops-order group" href={`/operacao/pedidos/${o.id}`}>
          <div className="hidden sm:grid place-items-center h-11 w-11 shrink-0 rounded-xl bg-stuw-sage/10 text-stuw-sage dark:text-stuw-champagne">
            <PackageCheck size={21} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold break-all">{o.number}</span>
              {(o.is_demo || o.payment_test_mode) && (
                <span className="ops-badge ops-badge-neutral">Teste</span>
              )}
            </div>
            <p className="text-xs text-stuw-slate">
              {o.customer_name} · {localTime(o.created_at)}
            </p>
            <div className="flex flex-wrap gap-2">
              <span
                className={`ops-badge ${o.payment_status === 'approved' ? '' : 'ops-badge-neutral'}`}
              >
                {PAYMENT_LABELS[o.payment_status] ?? o.payment_status}
              </span>
              <span className="ops-badge ops-badge-neutral">
                {stages.has(o.id)
                  ? OPERATION_STAGES[stages.get(o.id)!]
                  : o.payment_status === 'approved'
                    ? OPERATION_STAGES.awaiting_pick
                    : 'Preparação não iniciada'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <span className="font-medium text-sm whitespace-nowrap">{money(o.total_cents)}</span>
            <ArrowUpRight
              size={18}
              aria-hidden="true"
              className="text-stuw-sage dark:text-stuw-champagne"
            />
          </div>
        </Link>
      ))}
      {!orders.data.length && (
        <div className="py-12 text-center">
          <ShoppingBag
            size={30}
            strokeWidth={1}
            className="mx-auto mb-4 text-stuw-sage"
            aria-hidden="true"
          />
          <p className="font-serif text-2xl">Nenhum pedido nesta seleção</p>
          <p className="text-sm text-stuw-slate mt-2">
            Ajuste os filtros ou volte à primeira página.
          </p>
        </div>
      )}
      <nav className="ops-pagination" aria-label="Paginação de pedidos">
        <span className="mr-auto text-stuw-slate">Página {page}</span>
        {page > 1 && <Link href={orderPageHref(page - 1)}>Anterior</Link>}
        {page * 50 < (orders.count ?? 0) && (
          <Link href={orderPageHref(page + 1)}>Próxima página</Link>
        )}
      </nav>
    </section>
  );
}
