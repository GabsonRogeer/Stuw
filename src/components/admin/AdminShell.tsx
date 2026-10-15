import type { ReactNode } from 'react';
import { Layers3 } from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader/SiteHeader';
import { AdminNav } from './AdminNav';
import './admin.css';

export function AdminShell({
  children,
  superAdmin,
  operationsOnly = false,
  operation = false,
}: {
  children: ReactNode;
  superAdmin: boolean;
  operationsOnly?: boolean;
  operation?: boolean;
}) {
  return (
    <div className="admin-shell">
      <SiteHeader compact />
      <div className="page-container py-6 sm:py-10">
        <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
          <div className="ops-sidebar glass-card rounded-2xl p-4 lg:sticky lg:top-24 lg:p-5">
            <AdminNav superAdmin={superAdmin} operationsOnly={operationsOnly} />
          </div>
          <main className="min-w-0 space-y-6">
            <header className="ops-hero glass-card">
              <div>
                <p className="eyebrow mb-3">
                  {operation ? 'Gestão da loja / Operação' : 'STUW / Gestão da loja'}
                </p>
                <h1 className="font-serif text-4xl sm:text-5xl">
                  {operation ? 'Cada pedido, bem cuidado.' : 'Administração'}
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-stuw-slate">
                  {operation
                    ? 'Da separação ao pós-venda, acompanhe as etapas e mantenha sua equipe em sintonia.'
                    : 'Produtos, campanhas e pedidos. Tudo o que você precisa para cuidar da sua loja.'}
                </p>
              </div>
              <div className="ops-hero-icon" aria-hidden="true">
                <Layers3 size={30} strokeWidth={1.2} />
              </div>
            </header>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
