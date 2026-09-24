import type { Product } from '@/types';
import { ProductCard } from '@/components/catalog/ProductCard/ProductCard';

export function ProductGrid({
  products,
  prioritizeImages = true,
}: {
  products: Product[];
  prioritizeImages?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={prioritizeImages && index < 2} />
      ))}
    </div>
  );
}
