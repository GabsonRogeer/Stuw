import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CheckoutProvider } from '@/providers/checkout-provider';
import { CheckoutShell } from '@/components/checkout/CheckoutShell/CheckoutShell';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return (
    <CheckoutProvider>
      <CheckoutShell>{children}</CheckoutShell>
    </CheckoutProvider>
  );
}
