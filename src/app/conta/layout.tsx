import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requireAccount } from '@/lib/supabase/account';
import { SiteHeader } from '@/components/layout/SiteHeader/SiteHeader';
import { AccountNav } from '@/components/account/AccountNav';
export const metadata: Metadata = { title: 'Minha conta', robots: { index: false, follow: false } };
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await requireAccount();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const { data: admin } = await supabase.rpc('is_admin');
  const name =
    profile?.full_name ||
    (typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : '');
  return (
    <>
      <SiteHeader compact />
      <div className="page-container py-10 sm:py-14">
        <div className="mb-10">
          <p className="eyebrow mb-3">Seu espaço STUW</p>
          <h1 className="font-serif text-4xl sm:text-5xl">Minha conta</h1>
        </div>
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-10 lg:gap-16">
          <AccountNav name={name} email={user.email ?? ''} admin={admin === true} />
          <main className="min-w-0 max-w-4xl w-full">{children}</main>
        </div>
      </div>
    </>
  );
}
