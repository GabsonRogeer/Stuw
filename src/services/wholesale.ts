import type { Product } from '@/types';
import { isTaxDocumentValid } from './checkout';
export type WholesaleProduct = Pick<
  Product,
  'id' | 'title' | 'image' | 'hoverImage' | 'category' | 'sizes' | 'colors' | 'description'
>;
export type WholesaleLine = {
  id: number;
  size: string;
  color: string;
  qty: number;
  title: string;
  image: string;
};
export const QUOTE_LABELS: Record<string, string> = {
  received: 'Recebida',
  negotiating: 'Em negociação',
  approved: 'Aprovada',
  cancelled: 'Cancelada',
};
export const QUOTE_TRANSITIONS: Record<string, string[]> = {
  received: ['negotiating', 'cancelled'],
  negotiating: ['approved', 'cancelled'],
  approved: [],
  cancelled: [],
};
export const wholesaleKey = (item: Pick<WholesaleLine, 'id' | 'size' | 'color'>) =>
  JSON.stringify([item.id, item.size, item.color]);
export function restoreWholesale(value: unknown, products: WholesaleProduct[]): WholesaleLine[] {
  if (!Array.isArray(value)) return [];
  const result: WholesaleLine[] = [];
  for (const entry of value.slice(0, 50)) {
    if (!entry || typeof entry !== 'object') continue;
    const product = products.find((p) => p.id === entry.id);
    if (
      !product ||
      !product.sizes.includes(entry.size) ||
      !product.colors.some((c) => c.name === entry.color) ||
      !Number.isInteger(entry.qty) ||
      entry.qty < 1
    )
      continue;
    const item = {
      id: product.id,
      title: product.title,
      image: product.image,
      size: entry.size,
      color: entry.color,
      qty: Math.min(9999, entry.qty),
    };
    const prior = result.find((i) => wholesaleKey(i) === wholesaleKey(item));
    if (prior) prior.qty = Math.min(9999, prior.qty + item.qty);
    else result.push(item);
  }
  return result;
}
export function validWholesaleContact(value: {
  name: string;
  phone: string;
  company: string;
  cnpj: string;
  notes: string;
}) {
  if (!value.name.trim() || value.name.length > 200 || !/^\d{10,11}$/.test(value.phone))
    return 'Informe nome e telefone com DDD.';
  if (value.company.length > 200 || value.notes.length > 2000)
    return 'Confira o tamanho dos campos empresa e observações.';
  if (value.cnpj && (!/^[A-Z0-9]{12}\d{2}$/.test(value.cnpj) || !isTaxDocumentValid(value.cnpj)))
    return 'Informe um CNPJ válido ou deixe o campo vazio.';
  return null;
}
export function quoteWhatsAppUrl(
  phone: string,
  quote: { number: string; quantity: number; items: WholesaleLine[] },
) {
  if (!/^[1-9]\d{9,14}$/.test(phone)) return null;
  const lines = quote.items.map((i) => `${i.qty}x ${i.title} · ${i.color} · ${i.size}`);
  let text = `Olá, STUW! Gostaria de negociar a cotação ${quote.number}.\nTotal: ${quote.quantity} peças.\n${lines.join('\n')}\nValores e disponibilidade a combinar.`;
  // Keep links usable even for large lists; the full request is always in admin.
  if (encodeURIComponent(text).length > 5000)
    text = `Olá, STUW! Gostaria de negociar a cotação ${quote.number}, com ${quote.quantity} peças em ${quote.items.length} variantes. A lista completa está registrada no painel. Valores e disponibilidade a combinar.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
