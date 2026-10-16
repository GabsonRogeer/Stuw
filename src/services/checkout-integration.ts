import type { OrderItem } from '@/types/database';
import type { CheckoutInformation } from './checkout';
export type CheckoutLine = { id: number; color: string; size: string; qty: number };
export type QuotedProduct = OrderItem & {
  freeShipping?: boolean;
  sku: string;
  weight: number;
  width: number;
  height: number;
  length: number;
};
export type QuoteRequest = { information: CheckoutInformation; items: CheckoutLine[] };
export function validCheckoutLines(items: unknown): items is CheckoutLine[] {
  if (!Array.isArray(items) || !items.length || items.length > 50) return false;
  const identities = new Set<string>();
  return items.every((item) => {
    if (
      !item ||
      !Number.isSafeInteger(item.id) ||
      item.id < 1 ||
      typeof item.color !== 'string' ||
      !item.color ||
      item.color.length > 100 ||
      typeof item.size !== 'string' ||
      !item.size ||
      item.size.length > 50 ||
      !Number.isInteger(item.qty) ||
      item.qty < 1 ||
      item.qty > 99
    )
      return false;
    const key = JSON.stringify([item.id, item.color, item.size]);
    if (identities.has(key)) return false;
    identities.add(key);
    return true;
  });
}
export function quoteContext(request: QuoteRequest) {
  const info = request.information;
  return JSON.stringify([
    info.postalCode.replace(/\D/g, ''),
    info.street.trim(),
    info.number.trim(),
    info.complement.trim(),
    info.district.trim(),
    info.city.trim(),
    info.state,
    request.items
      .map((i) => [i.id, i.color, i.size, i.qty])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ]);
}
