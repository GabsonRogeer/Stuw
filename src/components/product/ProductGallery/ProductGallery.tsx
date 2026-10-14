'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product, ProductImage } from '@/types';

export function ProductGallery({
  product,
}: {
  product: Pick<Product, 'title' | 'image' | 'hoverImage' | 'galleryImages'>;
}) {
  const [selectedSource, setSelectedSource] = useState(product.image);
  const photos: ProductImage[] = [
    {
      src: product.image,
      alt:
        product.galleryImages?.find((m) => m.src === product.image)?.alt ??
        `${product.title} — vista principal`,
    },
    ...(product.hoverImage
      ? [
          {
            src: product.hoverImage,
            alt:
              product.galleryImages?.find((m) => m.src === product.hoverImage)?.alt ??
              `${product.title} — costas`,
          },
        ]
      : []),
    ...(product.galleryImages ?? []),
  ].filter((photo, index, all) => all.findIndex((entry) => entry.src === photo.src) === index);
  const selectedIndex = Math.max(
    0,
    photos.findIndex((photo) => photo.src === selectedSource),
  );
  const selected = photos[selectedIndex];

  function navigate(direction: number) {
    setSelectedSource((source) => {
      const index = Math.max(
        0,
        photos.findIndex((photo) => photo.src === source),
      );
      return photos[(index + direction + photos.length) % photos.length].src;
    });
  }

  return (
    <section
      aria-label={`Galeria de ${product.title}`}
      className="min-w-0"
      onKeyDown={(event) => {
        if (photos.length < 2) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          navigate(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-stuw-sand dark:bg-stone-900">
        <Image
          key={selected.src}
          src={selected.src}
          alt={selected.alt}
          fill
          priority={selected.src === product.image}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-contain"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Imagem anterior"
              onClick={() => navigate(-1)}
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/90 text-stuw-obsidian shadow-sm transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stuw-obsidian"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Próxima imagem"
              onClick={() => navigate(1)}
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/90 text-stuw-obsidian shadow-sm transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stuw-obsidian"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              Imagem {selectedIndex + 1} de {photos.length}: {selected.alt}
            </p>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-4" role="group" aria-label="Selecionar imagem">
          {photos.map((photo, index) => (
            <button
              key={photo.src}
              type="button"
              onClick={() => setSelectedSource(photo.src)}
              aria-label={`Ver imagem ${index + 1}: ${photo.alt}`}
              aria-pressed={selected.src === photo.src}
              className={`border p-1 ${selected.src === photo.src ? 'border-current' : 'border-transparent'}`}
            >
              <Image
                src={photo.src}
                alt=""
                width={56}
                height={72}
                className="w-14 h-[72px] object-contain bg-stuw-sand dark:bg-stone-900"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
