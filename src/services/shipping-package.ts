import type { ProductDraft } from './product-admin';

export const TEST_SHIPPING_PACKAGE = { weight: 300, length: 30, width: 20, height: 5 } as const;
export function withTestShippingPackage(product: ProductDraft): ProductDraft {
  const next = { ...product };
  for (const key of ['weight', 'length', 'width', 'height'] as const) {
    if (next[key] === null || next[key] === undefined) {
      next[key] = TEST_SHIPPING_PACKAGE[key];
      next.shippingPackageIsTest = true;
    }
  }
  return next;
}
