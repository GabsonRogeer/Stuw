import type { CartItem, Product } from '@/types';
import type { AppliedCoupon } from '@/services/coupons';

export const FREE_SHIPPING_THRESHOLD = 499;
export const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const itemKey = (item: Pick<CartItem, 'id' | 'size' | 'color'>) =>
  `${item.id}:${item.size}:${item.color}`;
export const productSlug = (product: Product) => product.slug;
const round = (value: number) => Math.round(value * 100) / 100;
export function productVariant(product: Product, color: string, size: string) {
  return product.variants?.find((v) => v.color === color && v.size === size);
}
export function availableQuantity(product: Product, color: string, size: string) {
  return product.variants ? Math.min(99, productVariant(product, color, size)?.stock ?? 0) : 99;
}

export function calculateTotals(
  items: CartItem[],
  coupon: string | AppliedCoupon | null = '',
  payment: 'pix' | 'card' | null = null,
  gift = false,
  shippingPrice?: number,
) {
  const subtotal = round(items.reduce((sum, item) => sum + item.price * item.qty, 0));
  const shipping =
    subtotal === 0
      ? 0
      : shippingPrice !== undefined && Number.isFinite(shippingPrice) && shippingPrice >= 0
        ? round(shippingPrice)
        : subtotal >= FREE_SHIPPING_THRESHOLD
          ? 0
          : 28;
  const giftCost = gift && items.length > 0 ? 35 : 0;
  // Strings support legacy demo callers; the storefront uses validated objects.
  const rate =
    typeof coupon === 'object' &&
    coupon &&
    Number.isFinite(coupon.percent) &&
    coupon.percent > 0 &&
    coupon.percent <= 100
      ? coupon.percent / 100
      : 0;
  const discount = rate
    ? round((subtotal + shipping + giftCost) * rate)
    : coupon === 'PRIVE10'
      ? round(subtotal * 0.1)
      : 0;
  const merchandiseDiscount = rate ? round(subtotal * rate) : discount;
  const pixDiscount = payment === 'pix' ? round((subtotal - merchandiseDiscount) * 0.05) : 0;
  return {
    subtotal,
    discount,
    pixDiscount,
    shipping,
    giftCost,
    total: round(subtotal - discount - pixDiscount + shipping + giftCost),
  };
}

export function addCartItem(
  items: CartItem[],
  product: Product,
  size: string,
  color: string,
): CartItem[] {
  const variant = productVariant(product, color, size);
  const limit = availableQuantity(product, color, size);
  if (
    limit < 1 ||
    product.price === null ||
    !product.sizes.includes(size) ||
    !product.colors.some((option) => option.name === color)
  )
    return items;
  const newItem: CartItem = {
    id: product.id,
    title: product.title,
    price: variant?.price ?? product.price,
    image: product.colorMedia?.[color]?.[0]?.src ?? product.image,
    size,
    color,
    qty: 1,
  };
  const key = itemKey(newItem);
  return items.some((item) => itemKey(item) === key)
    ? items.map((item) =>
        itemKey(item) === key ? { ...item, qty: Math.min(limit, item.qty + 1) } : item,
      )
    : [...items, newItem];
}

/** Restores variants using catalog prices, never prices supplied by browser storage. */
export function restoreCart(value: unknown, products: Product[]): CartItem[] {
  if (!Array.isArray(value)) return [];
  const result: CartItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const product = products.find((product) => product.id === entry.id);
    if (
      !product ||
      product.price === null ||
      !product.sizes.includes(entry.size) ||
      !product.colors.some((color) => color.name === entry.color)
    )
      continue;
    if (!Number.isInteger(entry.qty) || entry.qty < 1) continue;
    const limit = availableQuantity(product, entry.color, entry.size);
    if (limit < 1) continue;
    const item = {
      id: product.id,
      title: product.title,
      price: productVariant(product, entry.color, entry.size)?.price ?? product.price,
      image: product.colorMedia?.[entry.color]?.[0]?.src ?? product.image,
      size: entry.size as string,
      color: entry.color as string,
      qty: Math.min(limit, entry.qty),
    };
    const previous = result.find((existing) => itemKey(existing) === itemKey(item));
    if (previous) previous.qty = Math.min(limit, previous.qty + item.qty);
    else result.push(item);
  }
  return result;
}
