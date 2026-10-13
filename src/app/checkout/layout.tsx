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
      <CheckoutShell>
        {process.env.MERCADO_PAGO_ENVIRONMENT !== 'production' && (
          <p className="text-sm border rounded p-3 mb-6">
            Ambiente de teste. Use somente os dados de teste do Mercado Pago.
          </p>
        )}
        {children}
      </CheckoutShell>
    </CheckoutProvider>
  );
}
