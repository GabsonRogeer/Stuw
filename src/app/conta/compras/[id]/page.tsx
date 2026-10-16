import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAccount } from '@/lib/supabase/account';
import { isUuid } from '@/services/orders';
import { OrderDetails } from '@/components/orders/OrderDetails';
import { PaymentStatus } from '@/components/checkout/PaymentStatus';
import { loadOwnedInvoiceGeneration } from '@/lib/invoices/customer-history';
import { orderHistoryWithInvoice } from '@/services/order-history';
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
  const [eventResult, invoiceResult, generation] = await Promise.all([
    supabase.from('order_events').select('*').eq('order_id', id).order('created_at'),
    supabase
      .from('order_invoice_documents')
      .select('order_id,number,series,total_cents,authorized_at')
      .eq('order_id', id)
      .maybeSingle(),
    loadOwnedInvoiceGeneration(order, user.id),
  ]);
  const { data: invoice, error: invoiceError } = invoiceResult;
  const events = orderHistoryWithInvoice(order, eventResult.data ?? [], generation.data, invoice);
  return (
    <div className="space-y-7">
      <Link href="/conta/compras" className="text-sm underline">
        Voltar às compras
      </Link>
      <OrderDetails
        order={order}
        events={events}
        invoiceAvailable={!invoiceError && Boolean(invoice)}
      />
      {invoice && (
        <section
          aria-labelledby="invoice-title"
          className="rounded-2xl border border-stone-200 bg-white/70 p-6 shadow-sm"
        >
          <p className="text-xs uppercase tracking-widest text-stone-500">Documentos do pedido</p>
          <h2 id="invoice-title" className="mt-2 font-serif text-2xl">
            Sua nota fiscal
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            NF-e nº {invoice.number} · Série {invoice.series} · Autorizada em{' '}
            {new Date(invoice.authorized_at).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`/conta/compras/${id}/nota-fiscal/pdf`}
              className="rounded-lg bg-stone-900 px-5 py-3 text-sm font-medium text-white"
            >
              Baixar DANFE (PDF)
            </a>
            <a
              href={`/conta/compras/${id}/nota-fiscal/xml`}
              className="rounded-lg border border-stone-300 px-5 py-3 text-sm font-medium"
            >
              Baixar NF-e (XML)
            </a>
          </div>
        </section>
      )}
      {invoiceError && (
        <p role="alert" className="text-sm">
          Documentos fiscais temporariamente indisponíveis.
        </p>
      )}
      {!order.is_demo &&
        ['initializing', 'pending', 'in_process', 'authorized'].includes(order.payment_status) && (
          <PaymentStatus
            initial={{
              id: order.id,
              code: order.number,
              total: order.total_cents / 100,
              paymentStatus: order.payment_status,
              testMode: order.payment_test_mode,
            }}
          />
        )}
      {eventResult.error && <p role="alert">Histórico temporariamente indisponível.</p>}
      {generation.error && <p role="alert">Etapas fiscais temporariamente indisponíveis.</p>}
    </div>
  );
}
