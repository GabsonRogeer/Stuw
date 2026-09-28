import Link from 'next/link';
import { requireAccount } from '@/lib/supabase/account';
import { currency } from '@/lib/commerce';
const labels: Record<string, string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};
export default async function OrdersPage() {
  const { supabase, user } = await requireAccount();
  const { data, error } = await supabase
    .from('orders')
    .select('id,number,status,total_cents,created_at,is_demo')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  return (
    <>
      <h2 className="font-serif text-3xl border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        Minhas compras
      </h2>
      <p className="text-sm text-stuw-slate my-5">Acompanhe seus últimos 50 pedidos.</p>
      {error ? (
        <p role="alert">Não foi possível carregar suas compras. Tente novamente mais tarde.</p>
      ) : !data?.length ? (
        <div className="rounded-lg border border-stuw-border dark:border-stuw-borderDark p-8">
          <p className="mb-4">Você ainda não tem pedidos registrados.</p>
          <Link href="/produtos" className="underline text-sm">
            Explorar a coleção
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {data.map((order) => (
            <li
              key={order.id}
              className="border border-stuw-border dark:border-stuw-borderDark rounded-lg p-5 flex flex-wrap justify-between gap-4"
            >
              <div>
                <h3 className="font-medium break-all">
                  <Link href={`/conta/compras/${order.id}`} className="underline">
                    Pedido {order.number}
                  </Link>
                </h3>
                {order.is_demo && <p className="text-xs mt-2">Pedido de teste</p>}
                <p className="text-xs text-stuw-slate mt-2">
                  {new Date(order.created_at).toLocaleDateString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                  })}
                </p>
              </div>
              <div className="text-sm">
                <p>{labels[order.status] ?? order.status}</p>
                <p className="font-medium mt-2">{currency(order.total_cents / 100)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
