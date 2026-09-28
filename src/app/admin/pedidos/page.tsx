import { requireAdminPage } from '@/lib/supabase/admin-page';
export default async function Page() {
  await requireAdminPage();
  return (
    <>
      <h2 className="font-serif text-3xl border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        Pedidos
      </h2>
      <div className="mt-6 rounded-lg border border-stuw-border dark:border-stuw-borderDark p-8">
        <p className="font-medium">Em breve</p>
        <p className="text-sm text-stuw-slate mt-3">
          Este módulo será implementado na próxima etapa.
        </p>
      </div>
    </>
  );
}
