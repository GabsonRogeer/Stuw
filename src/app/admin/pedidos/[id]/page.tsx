import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { isUuid } from '@/services/orders';
import { OrderDetails } from '@/components/orders/OrderDetails';
import { OrderEditor } from '@/components/admin/OrderEditor';
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [orderResult, eventsResult] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('order_events').select('*').eq('order_id', id).order('created_at'),
  ]);
  if (orderResult.error || eventsResult.error)
    return <p role="alert">Não foi possível carregar o pedido. Tente novamente.</p>;
  if (!orderResult.data) notFound();
  const order = orderResult.data;
  return (
    <div className="space-y-7">
      <Link href="/admin/pedidos" className="text-sm underline">
        Voltar aos pedidos
      </Link>
      <OrderDetails order={order} events={eventsResult.data ?? []} />
      <OrderEditor key={order.revision} order={order} />
    </div>
  );
}
