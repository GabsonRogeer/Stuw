import { requireAdminPage } from '@/lib/supabase/admin-page';
import { getProducts } from '@/services/product-service';
import { CompleteLookEditor } from '@/components/admin/CompleteLookEditor';

export default async function CompleteLookPage() {
  const { supabase } = await requireAdminPage();
  const [result, products] = await Promise.all([
    supabase.from('complete_look_settings').select('*').eq('id', 'home').single(),
    getProducts(),
  ]);
  return (
    <>
      <h2 className="font-serif text-3xl">Look completo</h2>
      <p className="text-sm text-stuw-slate my-6">
        Escolha o conjunto e personalize a seção da home. Novos conjuntos publicados aparecem nesta
        seleção.
      </p>
      {result.error || !result.data ? (
        <p role="alert">Não foi possível carregar a seção. Recarregue a página.</p>
      ) : (
        <CompleteLookEditor initial={result.data} products={products} />
      )}
    </>
  );
}
