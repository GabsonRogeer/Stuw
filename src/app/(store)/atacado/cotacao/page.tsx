import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getWholesaleSettings } from '@/lib/supabase/wholesale';
import { QuoteCheckout } from '@/components/wholesale/QuoteCheckout';
export const metadata: Metadata = {
  title: 'Solicitar cotação',
  robots: { index: false, follow: false },
};
export default async function QuoteCheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/login?next=atacado');
  const [profile, settings] = await Promise.all([
    supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle(),
    getWholesaleSettings(),
  ]);
  return (
    <div className="page-container py-12 max-w-5xl">
      <h1 className="font-serif text-4xl mb-6">Sua cotação de atacado</h1>
      <QuoteCheckout
        key={user.id}
        email={user.email ?? ''}
        name={profile.data?.full_name ?? ''}
        phone={profile.data?.phone ?? ''}
        minimum={settings?.minimum_quantity ?? null}
      />
    </div>
  );
}
