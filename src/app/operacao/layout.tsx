import { Suspense } from 'react';
import type { Metadata } from 'next';
import { requireOperationPage } from '@/lib/supabase/operations-page';
import { AdminShell } from '@/components/admin/AdminShell';
import { OperationTabs } from '@/components/admin/OperationTabs';
export const metadata: Metadata = {
  title: 'Operação da loja',
  robots: { index: false, follow: false },
};
export default async function OperationLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireOperationPage();
  const [stock, audit, team] = await Promise.all(
    ['stock', 'audit', 'team'].map((permission) =>
      supabase.rpc('operation_allowed', { permission }),
    ),
  );
  const [admin, superAdmin] = await Promise.all([
    supabase.rpc('is_admin'),
    supabase.rpc('is_super_admin'),
  ]);
  return (
    <AdminShell
      superAdmin={superAdmin.data === true}
      operationsOnly={admin.data !== true}
      operation
    >
      <Suspense fallback={<div className="h-14" />}>
        <OperationTabs
          stock={stock.data === true}
          audit={audit.data === true}
          team={team.data === true}
        />
      </Suspense>
      <div className="ops-content">{children}</div>
    </AdminShell>
  );
}
