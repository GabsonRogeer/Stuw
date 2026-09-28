import type { Metadata } from 'next';
import { getProducts } from '@/services/product-service';
import { getWholesaleSettings } from '@/lib/supabase/wholesale';
import { WholesaleCatalog } from '@/components/wholesale/WholesaleCatalog';
export const metadata: Metadata = {
  title: 'Atacado',
  description:
    'Selecione peças STUW e solicite uma cotação de atacado. Valores e disponibilidade sob consulta.',
};
export default async function WholesalePage() {
  const [products, settings] = await Promise.all([getProducts(), getWholesaleSettings()]);
  const catalog = products.map(
    ({ id, title, image, hoverImage, category, sizes, colors, description }) => ({
      id,
      title,
      image,
      hoverImage,
      category,
      sizes,
      colors,
      description,
    }),
  );
  return (
    <div className="page-container py-12">
      <p className="eyebrow mb-3">STUW / B2B</p>
      <h1 className="font-serif text-4xl sm:text-5xl">Atacado STUW</h1>
      <p className="text-sm text-stuw-slate max-w-xl mt-5 mb-8">
        Escolha produtos, cores, tamanhos e quantidades. Nossa equipe confirma disponibilidade e
        negocia os valores pelo WhatsApp.
      </p>
      <WholesaleCatalog products={catalog} minimum={settings?.minimum_quantity ?? null} />
    </div>
  );
}
