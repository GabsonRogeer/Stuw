'use client';

import { ProductCardImage } from './ProductCardImage';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import type { Product } from '@/types';
import { currency } from '@/lib/commerce';
import { useCart } from '@/providers/cart-provider';
import { useWishlist } from '@/providers/wishlist-provider';
import { useStorefront } from '@/providers/storefront-provider';

export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const { addItem, ready } = useCart();
  const { ids, toggle } = useWishlist();
  const { setPanel } = useStorefront();
  const favorite = ids.includes(product.id);
  return (
    <article className="product-card group min-w-0">
      <div className="relative aspect-[3/4] bg-stuw-sand dark:bg-stone-900 overflow-hidden">
        <Link
          href={`/produtos/${product.slug}`}
          className="block h-full"
          aria-label={`Ver ${product.title}`}
        >
          <ProductCardImage product={product} priority={priority} />
        </Link>
        <button
          onClick={() => toggle(product.id)}
          aria-label={`${favorite ? 'Remover' : 'Adicionar'} ${product.title} ${favorite ? 'dos' : 'aos'} favoritos`}
          aria-pressed={favorite}
          className="absolute top-3 right-3 p-2 bg-stuw-canvas/85 text-stuw-obsidian rounded-full"
        >
          <Heart size={17} fill={favorite ? 'currentColor' : 'none'} strokeWidth={1.4} />
        </button>
        {product.price !== null && (
          <div className="quick-add absolute bottom-0 inset-x-0 bg-stuw-canvas/95 dark:bg-stuw-obsidian/95 py-3 px-1 flex justify-center gap-1 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 silk-transition">
            {product.sizes.map((size) => (
              <button
                key={size}
                disabled={!ready}
                onClick={() => {
                  addItem(product, size);
                  setPanel('cart');
                }}
                aria-label={`Adicionar ${product.title}, tamanho ${size}`}
                className="text-[10px] sm:text-xs min-w-7 sm:min-w-9 h-9 hover:bg-stuw-sand dark:hover:bg-stone-800 disabled:opacity-40"
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="pt-4 space-y-1.5">
        {product.fabric && (
          <p className="text-[9px] uppercase tracking-[.16em] text-stuw-slate">
            {product.fabric}™
          </p>
        )}
        <h3 className="text-xs sm:text-sm font-medium leading-relaxed">
          <Link href={`/produtos/${product.slug}`}>{product.title}</Link>
        </h3>
        <p className="text-xs sm:text-sm">
          {product.price === null ? 'Em breve' : currency(product.price)}
        </p>
        <div className="flex gap-1.5 pt-1">
          {product.colors.map((color) => (
            <span
              key={color.name}
              title={color.name}
              className="w-2.5 h-2.5 rounded-full border border-black/15"
              style={{
                backgroundColor: color.hex,
                backgroundImage: color.swatch ? `url("${color.swatch}")` : undefined,
                backgroundSize: 'cover',
              }}
            />
          ))}
        </div>
      </div>
    </article>
  );
}
