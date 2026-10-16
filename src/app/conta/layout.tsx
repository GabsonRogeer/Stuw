import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, UserRound } from 'lucide-react';
import { requireAccount } from '@/lib/supabase/account';
import { SiteHeader } from '@/components/layout/SiteHeader/SiteHeader';
import { AccountNav } from '@/components/account/AccountNav';
import '@/components/admin/admin.css';
import '@/components/account/account.css';
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
    <div className="admin-shell account-shell">
      <SiteHeader compact />
      <div className="page-container py-6 sm:py-10">
        <div className="flex justify-end mb-5">
          <Link href="/produtos" className="account-store-link glass-card">
            Voltar para a loja <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid items-start lg:grid-cols-[260px_minmax(0,1fr)] gap-6 lg:gap-8">
          <div className="account-sidebar glass-card min-w-0">
            <AccountNav name={name} email={user.email ?? ''} admin={admin === true} />
          </div>
          <main className="min-w-0 w-full space-y-6">
            <header className="ops-hero glass-card">
              <div>
                <p className="eyebrow mb-3">Seu espaço STUW</p>
                <h1 className="font-serif text-4xl sm:text-5xl">Minha conta</h1>
                <p className="mt-3 text-sm leading-relaxed text-stuw-slate">
                  Suas escolhas, seus pedidos e seus próximos movimentos.
                </p>
              </div>
              <div className="ops-hero-icon" aria-hidden="true">
                <UserRound size={30} strokeWidth={1.2} />
              </div>
            </header>
            <div className="admin-content glass-card">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
