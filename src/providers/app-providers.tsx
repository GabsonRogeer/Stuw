'use client';

import type { ReactNode } from 'react';
import type { Product } from '@/types';
import { CartProvider } from './cart-provider';
import { WishlistProvider } from './wishlist-provider';
import { StorefrontProvider } from './storefront-provider';
import { StorefrontOverlays } from '@/components/layout/StorefrontOverlays/StorefrontOverlays';

export function AppProviders({ children, products }: { children: ReactNode; products: Product[] }) {
  return (
    <CartProvider products={products}>
      <WishlistProvider>
        <StorefrontProvider>
          {children}
          <StorefrontOverlays products={products} />
        </StorefrontProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
