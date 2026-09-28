import { isInformationValid, isTaxDocumentValid, type CheckoutInformation } from './checkout';
export const ORDER_LABELS: Record<string, string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};
export const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export type OrderRequest = {
  key: string;
  information: CheckoutInformation;
  items: { id: number; size: string; color: string; qty: number }[];
  shipping: string;
  payment: string;
  installments: number;
  gift: boolean;
  giftWrap: boolean;
  coupon: string;
  expectedTotal: number;
  taxDocument: string;
};
export function validOrderRequest(value: OrderRequest) {
  try {
    return (
      isUuid(value.key) &&
      Object.values(value.information).every(
        (v) => typeof v === 'boolean' || (typeof v === 'string' && v.length <= 254),
      ) &&
      isInformationValid(value.information) &&
      isTaxDocumentValid(value.taxDocument) &&
      Array.isArray(value.items) &&
      value.items.length > 0 &&
      value.items.length <= 50 &&
      value.items.every(
        (i) =>
          Number.isInteger(i.id) &&
          typeof i.size === 'string' &&
          i.size.length <= 50 &&
          typeof i.color === 'string' &&
          i.color.length <= 100 &&
          Number.isInteger(i.qty) &&
          i.qty >= 1 &&
          i.qty <= 99,
      ) &&
      ['standard', 'express'].includes(value.shipping) &&
      ['pix', 'card'].includes(value.payment) &&
      Number.isInteger(value.installments) &&
      value.installments >= 1 &&
      value.installments <= 6 &&
      typeof value.gift === 'boolean' &&
      typeof value.giftWrap === 'boolean' &&
      typeof value.coupon === 'string' &&
      value.coupon.length <= 32 &&
      Number.isSafeInteger(value.expectedTotal) &&
      value.expectedTotal >= 0 &&
      value.expectedTotal <= 999999999
    );
  } catch {
    return false;
  }
}
