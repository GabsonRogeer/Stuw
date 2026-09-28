import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/layout/SiteHeader/SiteHeader';
import { AdminNav } from '@/components/admin/AdminNav';
import { requireAdminPage } from '@/lib/supabase/admin-page';
export const metadata: Metadata = {
  title: 'Administração STUW',
  robots: { index: false, follow: false },
};
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.rpc('is_super_admin');
  return (
    <>
      <SiteHeader compact />
      <div className="page-container py-10 sm:py-14">
        <p className="eyebrow mb-3">Gestão da loja</p>
        <h1 className="font-serif text-4xl sm:text-5xl mb-10">Administração</h1>
        <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] gap-10 lg:gap-14">
          <AdminNav superAdmin={data === true} />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </>
  );
}
