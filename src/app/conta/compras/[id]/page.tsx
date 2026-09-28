import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAccount } from '@/lib/supabase/account';
import { isUuid } from '@/services/orders';
import { OrderDetails } from '@/components/orders/OrderDetails';
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAccount();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return <p role="alert">Não foi possível carregar o pedido. Tente novamente.</p>;
  if (!order) notFound();
  const { data: events, error: eventsError } = await supabase
    .from('order_events')
    .select('*')
    .eq('order_id', id)
    .order('created_at');
  return (
    <div className="space-y-7">
      <Link href="/conta/compras" className="text-sm underline">
        Voltar às compras
      </Link>
      <OrderDetails order={order} events={events ?? []} />
      {eventsError && <p role="alert">Histórico temporariamente indisponível.</p>}
    </div>
  );
}
