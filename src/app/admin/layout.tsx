import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminPage } from '@/lib/supabase/admin-page';
export const metadata: Metadata = {
  title: 'Administração STUW',
  robots: { index: false, follow: false },
};
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.rpc('is_super_admin');
  return (
    <AdminShell superAdmin={data === true}>
      <div className="admin-content glass-card">{children}</div>
    </AdminShell>
  );
}
