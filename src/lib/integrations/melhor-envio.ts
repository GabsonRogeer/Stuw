import 'server-only';
import { shippingConfig } from './config';
import { integrationRequest } from './http';
import { toCents } from '@/services/fulfillment';
import type { ShippingOption } from '@/services/shipping';

export type ShippingProduct = {
  id: string;
  width: number;
  height: number;
  length: number;
  weight: number;
  insurance_value: number;
  quantity: number;
};
type Quote = {
  id: number;
  name: string;
  price: string;
  custom_price?: string;
  error?: string;
  company?: { name: string };
  delivery_range?: { min: number; max: number };
  custom_delivery_range?: { min: number; max: number };
};
export type MelhorTracking = {
  id: string;
  status: string;
  tracking?: string | null;
  generated_at?: string | null;
  posted_at?: string | null;
  delivered_at?: string | null;
};
async function request<T>(path: string, body: unknown) {
  const { production, token, contact } = shippingConfig();
  return integrationRequest<T>(
    'Melhor Envio',
    `https://${production ? 'www' : 'sandbox'}.melhorenvio.com.br/api/v2/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `STUW (${contact})`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
}
export async function calculateShipping(
  postalCode: string,
  products: ShippingProduct[],
): Promise<ShippingOption[]> {
  const origin = shippingConfig().postalCode;
  const quotes = await request<Quote[]>('me/shipment/calculate', {
    from: { postal_code: origin },
    to: { postal_code: postalCode },
    products,
    options: { receipt: false, own_hand: false },
  });
  if (!Array.isArray(quotes)) throw new Error('Cotação de frete indisponível.');
  return quotes
    .flatMap((quote) => {
      if (quote.error || !Number.isSafeInteger(quote.id) || quote.id < 1 || !quote.name) return [];
      const range = quote.custom_delivery_range ?? quote.delivery_range;
      if (
        !range ||
        !Number.isInteger(range.min) ||
        !Number.isInteger(range.max) ||
        range.min < 0 ||
        range.max < range.min
      )
        return [];
      try {
        return [
          {
            id: `me:${quote.id}`,
            name: `${quote.company?.name ?? 'Transportadora'} · ${quote.name}`,
            price: toCents(quote.custom_price ?? quote.price) / 100,
            deliveryEstimate: `${range.min} a ${range.max} dias úteis após a postagem`,
          },
        ];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.price - b.price);
}
export async function trackShipments(ids: string[]) {
  return request<Record<string, MelhorTracking>>('me/shipment/tracking', { orders: ids });
}
