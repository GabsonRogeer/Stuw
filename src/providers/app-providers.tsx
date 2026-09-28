'use client';

import type { ReactNode } from 'react';
import type { Product } from '@/types';
import { CartProvider } from './cart-provider';
import { WishlistProvider } from './wishlist-provider';
import { StorefrontProvider } from './storefront-provider';
import { StorefrontOverlays } from '@/components/layout/StorefrontOverlays/StorefrontOverlays';
import { PersonalizationProvider } from './personalization-provider';
import { PrivacyNotice } from '@/components/privacy/PrivacyNotice';
import { WholesaleProvider } from './wholesale-provider';

export function AppProviders({ children, products }: { children: ReactNode; products: Product[] }) {
  return (
    <CartProvider products={products}>
      <WholesaleProvider products={products}>
        <WishlistProvider>
          <StorefrontProvider>
            <PersonalizationProvider products={products}>
              {children}
              <StorefrontOverlays products={products} />
              <PrivacyNotice />
            </PersonalizationProvider>
          </StorefrontProvider>
        </WishlistProvider>
      </WholesaleProvider>
    </CartProvider>
  );
}
