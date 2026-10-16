import type { Order, OrderEvent } from '@/types/database';

export const INVOICE_HISTORY_LABELS: Record<string, string> = {
  invoice_generated: 'Nota fiscal gerada',
  invoice_authorized: 'Nota fiscal autorizada',
};

export type InvoiceGenerationHistory = {
  order_id: string;
  invoice_id: string | null;
  generate_attempted_at: string | null;
};
export type InvoiceDocumentHistory = {
  order_id: string;
  number: string;
  series: string;
  authorized_at: string;
};

export function orderHistoryWithInvoice(
  order: Pick<Order, 'id' | 'is_demo' | 'payment_test_mode'>,
  events: OrderEvent[],
  generation: InvoiceGenerationHistory | null,
  invoice: InvoiceDocumentHistory | null,
): OrderEvent[] {
  const history = events.filter((event) => event.order_id === order.id);
  if (!order.is_demo && !order.payment_test_mode) {
    // An attempt alone is not evidence of generation. An immutable invoice ID
    // must also have been recovered/recorded by the fiscal workflow.
    if (
      generation?.order_id === order.id &&
      /^[1-9]\d{0,18}$/.test(generation.invoice_id ?? '') &&
      generation.generate_attempted_at &&
      Number.isFinite(Date.parse(generation.generate_attempted_at)) &&
      !history.some((event) => event.status === 'invoice_generated')
    )
      history.push({
        id: `invoice-generated-${order.id}`,
        order_id: order.id,
        actor_id: null,
        status: 'invoice_generated',
        note: 'A nota fiscal deste pedido foi gerada.',
        created_at: generation.generate_attempted_at,
      });
    // This metadata only exists after authorized production XML and its PDF
    // have been validated and stored. Drafts cannot appear as authorized.
    if (
      invoice?.order_id === order.id &&
      Number.isFinite(Date.parse(invoice.authorized_at)) &&
      !history.some((event) => event.status === 'invoice_authorized')
    )
      history.push({
        id: `invoice-authorized-${order.id}`,
        order_id: order.id,
        actor_id: null,
        status: 'invoice_authorized',
        note: `NF-e nº ${invoice.number}, série ${invoice.series}. Documentos disponíveis para consulta.`,
        created_at: invoice.authorized_at,
      });
  }
  const rank = (status: string) =>
    status === 'invoice_generated' ? 1 : status === 'invoice_authorized' ? 2 : 0;
  return history.sort(
    (a, b) =>
      Date.parse(a.created_at) - Date.parse(b.created_at) || rank(a.status) - rank(b.status),
  );
}
