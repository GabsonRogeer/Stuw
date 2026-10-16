import type { Order } from '@/types/database';
import { toCents } from '@/services/fulfillment';

export function assertInvoiceOrder(order: Order) {
  if (
    order.is_demo ||
    order.payment_test_mode ||
    order.payment_status !== 'approved' ||
    order.total_cents <= 0
  )
    throw new Error('Somente um pedido real com pagamento aprovado pode ser faturado.');
  const sum = order.items.reduce((total, item) => total + item.qty * item.price_cents, 0);
  if (
    !order.items.length ||
    sum !== order.subtotal_cents ||
    sum +
      order.shipping_cents +
      order.gift_cents -
      order.discount_cents -
      order.pix_discount_cents !==
      order.total_cents
  )
    throw new Error('Valores do pedido não conciliados.');
}
export function assertRemoteInvoiceOrder(
  order: Order,
  remote: Record<string, unknown>,
  remoteId: string,
  taxDocument: string,
) {
  assertInvoiceOrder(order);
  const customer = remote.cliente as { cpf_cnpj?: string } | undefined;
  if (
    String(remote.id) !== remoteId ||
    remote.numero_ecommerce !== order.number ||
    toCents(remote.total_pedido) !== order.total_cents ||
    !taxDocument ||
    customer?.cpf_cnpj?.replace(/\D/g, '') !== taxDocument
  )
    throw new Error('Pedido ou cliente na Olist divergente; revise antes de gerar a nota.');
}
export function assertRemoteInvoice(
  order: Order,
  invoice: Record<string, unknown>,
  remoteId: string,
  invoiceId: string,
  taxDocument: string,
  reservedComponents: { sku: string; quantity: number }[] = [],
) {
  assertInvoiceOrder(order);
  const customer = invoice.cliente as { cpf_cnpj?: string } | undefined;
  if (
    String(invoice.id) !== invoiceId ||
    String(invoice.id_venda) !== remoteId ||
    toCents(invoice.valor_nota) !== order.total_cents ||
    !taxDocument ||
    customer?.cpf_cnpj?.replace(/\D/g, '') !== taxDocument
  )
    throw new Error('Nota fiscal, cliente, pedido ou valor divergente.');
  const items = invoice.itens as
    | { item: { codigo?: string; quantidade?: string | number; ncm?: string; cfop?: string } }[]
    | undefined;
  const expected = new Map<string, number>();
  const actual = new Map<string, number>();
  for (const item of order.items) {
    if (!item.sku) throw new Error('SKU fiscal não identificado.');
    expected.set(item.sku, (expected.get(item.sku) ?? 0) + item.qty);
  }
  for (const { item } of items ?? []) {
    const quantity = Number(item.quantidade);
    if (!item.codigo || !Number.isSafeInteger(quantity) || quantity <= 0)
      throw new Error('Itens fiscais inválidos.');
    if (!/^(?!0{8}$)\d{8}$/.test(String(item.ncm ?? '').replace(/[.\s]/g, '')))
      throw new Error(
        'Item da nota fiscal sem NCM válido. Corrija a nota na Olist antes de emitir.',
      );
    if (!/^[1-7]\d{3}$/.test(String(item.cfop ?? '')))
      throw new Error(
        'Item da nota fiscal sem CFOP válido. Revise a configuração fiscal na Olist.',
      );
    actual.set(item.codigo, (actual.get(item.codigo) ?? 0) + quantity);
  }
  const matches = (candidate: Map<string, number>) =>
    candidate.size > 0 &&
    candidate.size === actual.size &&
    [...candidate].every(([sku, qty]) => actual.get(sku) === qty);
  const components = new Map<string, number>();
  for (const item of reservedComponents) {
    if (
      !item.sku ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      components.has(item.sku)
    )
      throw new Error('Reserva dos componentes fiscais inválida.');
    components.set(item.sku, item.quantity);
  }
  if (!matches(expected) && !matches(components))
    throw new Error('Itens da nota fiscal divergentes.');
}
export function invoiceState(
  invoice: Record<string, unknown>,
): 'authorized' | 'blocked' | 'generated' | 'processing' {
  const status = Number(invoice.situacao);
  if (status === 6 && /^\d{44}$/.test(String(invoice.chave_acesso ?? ''))) return 'authorized';
  if ([3, 5, 10].includes(status)) return 'blocked';
  if (status === 1) return 'generated';
  return 'processing';
}
