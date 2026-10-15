import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { currency } from '@/lib/commerce';
import type { Product } from '@/types';
import {
  completeLookProduct,
  completeLookImages,
  defaultCompleteLook,
  type CompleteLookSettings,
} from '@/services/complete-look';

export function CompleteLookSection({
  products,
  settings = defaultCompleteLook,
}: {
  products: Product[];
  settings?: CompleteLookSettings;
}) {
  const product = completeLookProduct(products, settings);
  if (!settings.enabled || !product || product.price === null) return null;
  const image =
    settings.image && completeLookImages(product).includes(settings.image)
      ? settings.image
      : product.image;

  return (
    <section aria-labelledby="complete-look-title" className="bg-stuw-sand dark:bg-stone-900">
      <div className="page-container grid lg:grid-cols-2 gap-8 lg:gap-16 py-10 sm:py-16 lg:py-20">
        <Link
          href={`/produtos/${product.slug}`}
          aria-label={`Conhecer ${product.title}`}
          className="group relative block aspect-[4/5] w-full max-w-[560px] mx-auto overflow-hidden bg-white/40 dark:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <Image
            src={image}
            alt={product.title}
            fill
            sizes="(max-width: 1023px) 90vw, 45vw"
            className="object-contain"
          />
          <span className="absolute left-5 top-5 rounded-full bg-stuw-canvas/90 px-4 py-2 text-[10px] uppercase tracking-[.18em] text-stuw-obsidian backdrop-blur-sm">
            {settings.eyebrow}
          </span>
          <span className="absolute bottom-5 right-5 grid size-11 place-items-center rounded-full bg-stuw-canvas/90 text-stuw-obsidian">
            <ArrowUpRight size={20} aria-hidden="true" />
          </span>
        </Link>
        <div className="flex flex-col justify-center items-start py-4 lg:py-8">
          <p className="eyebrow mb-5">{settings.eyebrow}</p>
          <h2
            id="complete-look-title"
            className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.1] break-words max-w-full"
          >
            {settings.title}
            <br />
            <em className="text-stuw-sage dark:text-stuw-champagne">{settings.accent}</em>
          </h2>
          <p className="text-sm leading-relaxed text-stuw-slate mt-6 max-w-sm">
            {settings.description}
          </p>
          <div className="w-full max-w-md border-t border-stuw-border dark:border-stuw-borderDark mt-9 pt-6">
            <p className="text-[10px] uppercase tracking-[.16em] text-stuw-slate mb-2">
              Nesta seleção
            </p>
            <h3 className="font-serif text-2xl">{product.title}</h3>
            <p className="text-sm mt-3">{currency(product.price)}</p>
            <Link
              href={`/produtos/${product.slug}`}
              className="mt-6 inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-10 bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian px-6 py-4 text-xs uppercase tracking-widest transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {settings.button_label} <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <Link
            href="/produtos?categoria=Conjuntos"
            className="mt-7 border-b border-current pb-1 text-xs"
          >
            Explorar todos os conjuntos
          </Link>
        </div>
      </div>
    </section>
  );
}
