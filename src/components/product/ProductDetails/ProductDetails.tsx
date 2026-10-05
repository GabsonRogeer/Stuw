'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, ArrowLeft } from 'lucide-react';
import type { Product } from '@/types';
import { currency, availableQuantity, productVariant } from '@/lib/commerce';
import { useCart } from '@/providers/cart-provider';
import { useWishlist } from '@/providers/wishlist-provider';
import { useStorefront } from '@/providers/storefront-provider';
import { Button } from '@/components/ui/button/button';
import { ProductGallery } from '@/components/product/ProductGallery/ProductGallery';
import {
  ProductDiscovery,
  ProductViewTracker,
} from '@/components/product/ProductDiscovery/ProductDiscovery';

export function ProductDetails({ product, related }: { product: Product; related?: Product }) {
  const [color, setColor] = useState(product.colors[0]?.name ?? '');
  const [size, setSize] = useState('');
  const { addItem, ready } = useCart();
  const { ids, toggle } = useWishlist();
  const { setPanel } = useStorefront();
  const photos = product.colorMedia?.[color];
  const selectedProduct = photos?.length
    ? { ...product, image: photos[0].src, hoverImage: undefined, galleryImages: photos }
    : product;
  const price = productVariant(product, color, size)?.price ?? product.price;
  if (product.price === null) {
    return (
      <div className="page-container py-6 sm:py-10">
        <ProductViewTracker productId={product.id} />
        <Link href="/produtos" className="inline-flex items-center gap-2 text-xs mb-6">
          <ArrowLeft size={14} /> Coleção
        </Link>
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-20">
          <ProductGallery key={product.id} product={product} />
          <div className="lg:sticky lg:top-40 self-start py-3">
            <p className="eyebrow mb-4">STUW / Novidades</p>
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight">{product.title}</h1>
            <p className="mt-6 text-lg">Em breve</p>
            <p className="text-sm text-stuw-slate mt-4 leading-relaxed">
              Esta peça ainda não está disponível para compra.
            </p>
            <p className="text-sm text-stuw-slate mt-4 leading-relaxed">{product.description}</p>
            <button
              onClick={() => toggle(product.id)}
              aria-pressed={ids.includes(product.id)}
              className="inline-flex items-center gap-3 mt-8 p-4 border border-stuw-border dark:border-stuw-borderDark text-xs"
            >
              <Heart size={20} fill={ids.includes(product.id) ? 'currentColor' : 'none'} />
              {ids.includes(product.id) ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
            </button>
          </div>
        </div>
        <ProductDiscovery currentProductId={product.id} />
      </div>
    );
  }
  return (
    <div className="page-container py-6 sm:py-10">
      <ProductViewTracker productId={product.id} />
      <Link href="/produtos" className="inline-flex items-center gap-2 text-xs mb-6">
        <ArrowLeft size={14} /> Coleção
      </Link>
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-20">
        <ProductGallery key={`${product.id}-${color}`} product={selectedProduct} />
        <div className="lg:sticky lg:top-40 self-start py-3">
          <p className="eyebrow mb-4">
            {product.fabric}™ / {product.category}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-tight">{product.title}</h1>
          {product.comparePrice && price !== null && product.comparePrice > price ? (
            <p className="mt-6 text-sm text-stuw-slate line-through">
              {currency(product.comparePrice)}
            </p>
          ) : null}
          <p className="mt-6 text-lg">{currency(price ?? product.price)}</p>
          <p className="text-xs text-stuw-slate mt-2">
            ou 6x de {currency((price ?? product.price) / 6)} sem juros
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-stuw-slate mb-1">Coleção</dt>
              <dd>
                <Link
                  href={`/produtos?colecao=${encodeURIComponent(product.collection)}`}
                  className="underline"
                >
                  {product.collection}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-stuw-slate mb-1">Categoria</dt>
              <dd>
                <Link
                  href={`/produtos?categoria=${encodeURIComponent(product.activityCategory)}`}
                  className="underline"
                >
                  {product.activityCategory}
                </Link>
              </dd>
            </div>
          </dl>
          <fieldset className="mt-9">
            <legend className="text-xs mb-4">
              Cor: <span className="text-stuw-slate">{color}</span>
            </legend>
            <div className="flex gap-3">
              {product.colors.map((option) => (
                <button
                  key={option.name}
                  onClick={() => {
                    setColor(option.name);
                    setSize('');
                  }}
                  aria-label={option.name}
                  aria-pressed={color === option.name}
                  title={option.name}
                  className={`w-7 h-7 rounded-full border border-black/15 ring-offset-4 ring-offset-stuw-canvas dark:ring-offset-stuw-obsidian ${color === option.name ? 'ring-1 ring-stuw-slate' : ''}`}
                  style={{
                    backgroundColor: option.hex,
                    backgroundImage: option.swatch ? `url("${option.swatch}")` : undefined,
                    backgroundSize: 'cover',
                  }}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-8">
            <legend className="text-xs mb-3">Tamanho</legend>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((option) => (
                <button
                  key={option}
                  onClick={() => setSize(option)}
                  disabled={availableQuantity(product, color, option) === 0}
                  aria-pressed={size === option}
                  className={`min-w-12 h-12 border text-xs disabled:opacity-30 disabled:line-through ${size === option ? 'bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian border-current' : 'border-stuw-border dark:border-stuw-borderDark hover:border-current'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            onClick={() => setPanel('fit')}
            className="mt-4 underline text-xs text-stuw-slate"
          >
            Guia de tamanhos
          </button>
          <div className="flex gap-3 mt-8">
            <Button
              disabled={!size || !ready || availableQuantity(product, color, size) === 0}
              className="flex-1 !rounded-none !py-4"
              onClick={() => {
                addItem(product, size, color);
                setPanel('cart');
              }}
            >
              {size ? 'Adicionar à sacola' : 'Selecione um tamanho'}
            </Button>
            <button
              onClick={() => toggle(product.id)}
              aria-label="Salvar nos favoritos"
              aria-pressed={ids.includes(product.id)}
              className="p-4 border border-stuw-border dark:border-stuw-borderDark"
            >
              <Heart size={20} fill={ids.includes(product.id) ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div className="mt-9 border-y border-stuw-border dark:border-stuw-borderDark divide-y divide-stuw-border dark:divide-stuw-borderDark">
            {product.measurements && (
              <details className="py-4">
                <summary className="cursor-pointer text-xs font-medium">Tabela de medidas</summary>
                <p className="text-sm whitespace-pre-line mt-4">{product.measurements}</p>
                {product.sizeGuide && (
                  <a className="underline text-xs" href={product.sizeGuide}>
                    Consultar guia de tamanhos
                  </a>
                )}
              </details>
            )}
            {(product.care || product.composition) && (
              <details className="py-4">
                <summary className="cursor-pointer text-xs font-medium">
                  Composição e cuidados
                </summary>
                <p className="text-sm whitespace-pre-line mt-4">
                  {product.composition}
                  {'\n'}
                  {product.care}
                </p>
              </details>
            )}
            <details open className="py-4">
              <summary className="cursor-pointer text-xs font-medium">Sobre a peça</summary>
              <p className="text-sm text-stuw-slate leading-relaxed mt-4">{product.description}</p>
            </details>
            <details className="py-4">
              <summary className="cursor-pointer text-xs font-medium">Tecido & sensação</summary>
              <p className="text-sm text-stuw-slate mt-4">
                {product.fabric}™ · {product.feelTag}
              </p>
            </details>
            <details className="py-4">
              <summary className="cursor-pointer text-xs font-medium">Entrega & trocas</summary>
              <p className="text-sm text-stuw-slate mt-4">
                Frete cortesia a partir de R$ 499. Consulte o atendimento para condições de entrega
                e troca.
              </p>
            </details>
          </div>
          {related && (
            <div className="mt-8">
              <p className="eyebrow mb-4">Complete o look</p>
              <Link href={`/produtos/${related.slug}`} className="flex gap-4 items-center">
                <Image
                  src={related.image}
                  alt={related.title}
                  width={64}
                  height={85}
                  className="w-16 h-20 object-cover"
                />
                <div>
                  <p className="text-xs">{related.title}</p>
                  <p className="text-xs text-stuw-slate mt-2">
                    {related.price === null ? 'Em breve' : currency(related.price)}
                  </p>
                </div>
                <span className="ml-auto">→</span>
              </Link>
            </div>
          )}
        </div>
      </div>
      <ProductDiscovery currentProductId={product.id} />
    </div>
  );
}
