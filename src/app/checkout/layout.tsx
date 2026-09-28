import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CheckoutProvider } from '@/providers/checkout-provider';
import { CheckoutShell } from '@/components/checkout/CheckoutShell/CheckoutShell';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default async function CheckoutLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/login?next=checkout');
  return (
    <CheckoutProvider>
      <CheckoutShell>{children}</CheckoutShell>
    </CheckoutProvider>
  );
}
