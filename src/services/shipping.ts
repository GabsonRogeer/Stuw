import { FREE_SHIPPING_THRESHOLD } from '@/lib/commerce';

export type ShippingOption = {
  id: string;
  name: string;
  price: number;
  deliveryEstimate: string;
};
export type ShippingQuoteRequest = { postalCode: string; subtotal: number };

/** Local quotation adapter. Replace with carrier/API quotes when shipping is connected. */
export function quoteShipping({ postalCode, subtotal }: ShippingQuoteRequest): ShippingOption[] {
  if (!/^\d{8}$/.test(postalCode.replace(/\D/g, '')) || !Number.isFinite(subtotal) || subtotal <= 0)
    return [];
  return [
    {
      id: 'standard',
      name: 'Entrega econômica',
      price: subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 28,
      deliveryEstimate: '5 a 8 dias úteis',
    },
    { id: 'express', name: 'Entrega expressa', price: 45, deliveryEstimate: '2 a 3 dias úteis' },
  ];
}
