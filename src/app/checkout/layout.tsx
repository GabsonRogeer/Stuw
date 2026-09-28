import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CheckoutProvider } from '@/providers/checkout-provider';
import { CheckoutShell } from '@/components/checkout/CheckoutShell/CheckoutShell';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { loadCheckoutProfile } from '@/lib/supabase/checkout-profile';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default async function CheckoutLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/login?next=checkout');
  const saved = await loadCheckoutProfile(supabase, user.id);
  return (
    <CheckoutProvider
      key={user.id}
      email={user.email ?? ''}
      profile={saved.profile}
      addresses={saved.addresses}
      loadError={saved.loadError}
    >
      <CheckoutShell>{children}</CheckoutShell>
    </CheckoutProvider>
  );
}
