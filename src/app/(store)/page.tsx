import Link from 'next/link';
import { HeroSection } from '@/components/home/HeroSection/HeroSection';
import { FabricSection } from '@/components/home/FabricSection/FabricSection';
import { LifestyleSection } from '@/components/home/LifestyleSection/LifestyleSection';
import { ProductGrid } from '@/components/catalog/ProductGrid/ProductGrid';
import { getProducts } from '@/services/product-service';
import { ProductDiscovery } from '@/components/product/ProductDiscovery/ProductDiscovery';
import { getPublishedBanners } from '@/repositories/banners';
import { BannerCarousel } from '@/components/home/ManagedBanner/BannerCarousel';

export const revalidate = 60;

export default async function HomePage() {
  const [products, banners] = await Promise.all([getProducts(), getPublishedBanners()]);
  // This dynamic server component supplies one shared clock snapshot for hydration.
  // eslint-disable-next-line react-hooks/purity
  const serverNow = Date.now();
  const featuredProducts = [
    ...products.filter((product) => product.featured),
    ...products.filter((product) => !product.featured),
  ].slice(0, 8);
  return (
    <>
      <BannerCarousel banners={banners} serverNow={serverNow} fallback={<HeroSection />} />
      <section id="catalogo" className="page-container py-16 sm:py-24">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="eyebrow mb-3">A seleção STUW</p>
            <h2 className="font-serif text-3xl sm:text-4xl">Essenciais em movimento.</h2>
          </div>
          <Link href="/produtos" className="text-xs border-b border-current pb-1 whitespace-nowrap">
            Ver coleção
          </Link>
        </div>
        <ProductGrid products={featuredProducts} />
      </section>
      <div className="page-container">
        <ProductDiscovery />
      </div>
      <FabricSection />
      <LifestyleSection />
    </>
  );
}
