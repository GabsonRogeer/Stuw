export const SHIPMENT_LABELS: Record<string, string> = {
  pending: 'Envio pendente',
  label_generated: 'Etiqueta gerada',
  shipped: 'Produto enviado',
  in_transit: 'Produto a caminho',
  delivered: 'Produto entregue',
  exception: 'Entrega com ocorrência',
  cancelled: 'Envio cancelado',
};
export const SHIPMENT_STEPS = [
  'pending',
  'label_generated',
  'shipped',
  'in_transit',
  'delivered',
] as const;
export const PAYMENT_LABELS: Record<string, string> = {
  initializing: 'Conferindo pagamento',
  pending: 'Aguardando pagamento',
  in_process: 'Pagamento em análise',
  authorized: 'Pagamento em análise',
  approved: 'Pagamento aprovado',
  rejected: 'Pagamento recusado',
  cancelled: 'Pagamento cancelado',
  refunded: 'Pagamento com estorno',
  charged_back: 'Pagamento contestado',
};
export type CardPaymentData = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments: number;
  payer: { email: string; identification: { type: string; number: string } };
};
export type CheckoutPaymentResult = {
  testMode?: boolean;
  id: string;
  code: string;
  total: number;
  paymentStatus: string;
  paymentIssue?: { kind: 'request_rejected'; message: string };
  pix?: { code: string; image: string; expiresAt: string };
};
export function toCents(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Invalid amount');
  const n = Number(value);
  if (value === '' || !Number.isFinite(n) || n < 0 || n > 9999999.99)
    throw new Error('Invalid amount');
  return Math.round(n * 100);
}
export function shippingStatus(value: {
  status?: string;
  tracking?: string | null;
  generated_at?: string | null;
}) {
  if (value.status === 'delivered') return 'delivered';
  if (value.status === 'posted') return 'in_transit';
  if (['undelivered', 'suspended'].includes(value.status ?? '')) return 'exception';
  if (['canceled', 'cancelled'].includes(value.status ?? '')) return 'cancelled';
  if (value.status === 'released' && (value.generated_at || value.tracking))
    return 'label_generated';
  return 'pending';
}
