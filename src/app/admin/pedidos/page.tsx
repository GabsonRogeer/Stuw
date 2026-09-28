import Link from 'next/link';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { ORDER_LABELS } from '@/services/orders';
import { currency } from '@/lib/commerce';
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; mode?: string }>;
}) {
  const { supabase } = await requireAdminPage();
  const params = await searchParams;
  const status = Object.hasOwn(ORDER_LABELS, params.status ?? '') ? params.status! : '';
  const q = (params.q ?? '')
    .replace(/[^\p{L}\p{N}@.\s-]/gu, '')
    .trim()
    .slice(0, 100);
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.page) || 1)));
  const mode = ['demo', 'live'].includes(params.mode ?? '') ? params.mode! : '';
  let query = supabase
    .from('orders')
    .select('id,number,status,total_cents,created_at,customer_name,customer_email,is_demo', {
      count: 'exact',
    });
  if (status) query = query.eq('status', status);
  if (mode) query = query.eq('is_demo', mode === 'demo');
  if (q)
    query = query.or(`number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_email.ilike.%${q}%`);
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 20, page * 20 - 1);
  const href = (next: number) =>
    '/admin/pedidos?' + new URLSearchParams({ status, q, mode, page: String(next) });
  return (
    <>
      <h2 className="font-serif text-3xl border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        Pedidos
      </h2>
      <p className="text-sm text-stuw-slate my-5">
        Acompanhe compras, entregas e pedidos de teste.
      </p>
      <form className="grid sm:grid-cols-2 gap-3 mb-7">
        <label className="text-xs">
          Buscar por número, nome ou e-mail
          <input name="q" defaultValue={q} maxLength={100} className="field mt-2" />
        </label>
        <label className="text-xs">
          Status
          <select name="status" defaultValue={status} className="field mt-2">
            <option value="">Todos os status</option>
            {Object.entries(ORDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Tipo
          <select name="mode" defaultValue={mode} className="field mt-2">
            <option value="">Todos</option>
            <option value="demo">Teste</option>
            <option value="live">Real</option>
          </select>
        </label>
        <button className="self-end py-3 border rounded-md border-stuw-border dark:border-stuw-borderDark text-sm">
          Filtrar pedidos
        </button>
      </form>
      {error ? (
        <p role="alert">
          Não foi possível carregar os pedidos. Verifique se a migração de pedidos foi aplicada e
          tente novamente.
        </p>
      ) : (
        <>
          <p className="text-xs text-stuw-slate mb-4">{count ?? 0} pedido(s) encontrado(s)</p>
          {!data?.length && <p className="py-8 text-sm">Nenhum pedido nesta seleção.</p>}
          <ul className="space-y-3">
            {data?.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/pedidos/${order.id}`}
                  className="block border rounded-lg p-5 border-stuw-border dark:border-stuw-borderDark hover:bg-stuw-sand/40 dark:hover:bg-stone-800"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <span className="text-sm font-medium break-all">{order.number}</span>
                    <span className="text-sm">{currency(order.total_cents / 100)}</span>
                  </div>
                  <p className="text-sm mt-2">
                    {order.customer_name || 'Cliente cadastrado'} · {ORDER_LABELS[order.status]}
                  </p>
                  <p className="text-xs text-stuw-slate mt-2">
                    {new Date(order.created_at).toLocaleDateString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                    })}
                    {order.is_demo ? ' · Teste' : ''} · Ver detalhes
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginação de pedidos" className="flex justify-between mt-6 text-sm">
            {page > 1 ? <Link href={href(page - 1)}>Anterior</Link> : <span />}
            <span>Página {page}</span>
            {page * 20 < (count ?? 0) ? <Link href={href(page + 1)}>Próxima</Link> : <span />}
          </nav>
        </>
      )}
    </>
  );
}
