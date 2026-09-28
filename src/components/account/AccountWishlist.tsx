'use client';
import Link from 'next/link';
import { useWishlist } from '@/providers/wishlist-provider';
import { ProductCard } from '@/components/catalog/ProductCard/ProductCard';
import type { Product } from '@/types';
export function AccountWishlist({ products }: { products: Product[] }) {
  const { ids } = useWishlist();
  const saved = products.filter((product) => ids.includes(product.id));
  return (
    <>
      <p className="text-sm text-stuw-slate my-5">As peças que você salvou neste navegador.</p>
      {saved.length ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-5">
          {saved.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-stuw-border dark:border-stuw-borderDark p-8">
          <p className="mb-4">Sua wishlist ainda está vazia.</p>
          <Link href="/produtos" className="underline text-sm">
            Explorar a coleção
          </Link>
        </div>
      )}
    </>
  );
}
