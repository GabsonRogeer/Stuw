import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { emptyProduct, fromLegacy } from '@/services/product-admin';
import { PRODUCTS } from '@/data/products';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdminPage();
  const { id } = await params;
  if (id === 'novo')
    return (
      <>
        <h2 className="font-serif text-3xl mb-6">Novo produto</h2>
        <ProductEditor initial={emptyProduct()} />
      </>
    );
  if (!/^\d+$/.test(id)) notFound();
  const { data, error } = await supabase
    .from('admin_products')
    .select('*')
    .eq('id', Number(id))
    .maybeSingle();
  if (error)
    return (
      <p role="alert">
        Não foi possível carregar o cadastro. Confira a migração e tente novamente.
      </p>
    );
  if (data?.deleted_at) notFound();
  const legacy = PRODUCTS.find((p) => p.id === Number(id));
  if (!data && !legacy) notFound();
  return (
    <>
      <h2 className="font-serif text-3xl mb-6">{data ? 'Editar produto' : 'Preparar cadastro'}</h2>
      {!data && (
        <p className="text-sm text-stuw-slate mb-6">
          Confira o nome do modelo, as fotos de cada cor e o estoque real dos SKUs antes de
          publicar. O catálogo atual será preservado enquanto este cadastro estiver em rascunho.
        </p>
      )}
      <ProductEditor
        initial={data?.document ?? fromLegacy(legacy!)}
        record={data ?? undefined}
        legacyId={legacy?.id}
        legacyImages={
          legacy
            ? [
                { src: legacy.image, alt: `${legacy.title} — frente`, role: 'frente' },
                ...(legacy.hoverImage
                  ? [
                      {
                        src: legacy.hoverImage,
                        alt: `${legacy.title} — costas`,
                        role: 'costas' as const,
                      },
                    ]
                  : []),
                ...(legacy.galleryImages ?? []).map((m) => ({ ...m, role: 'detalhe' as const })),
              ]
            : []
        }
      />
    </>
  );
}
