'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  const selected = photos.find((photo) => photo.src === selectedSource) ?? photos[0];

  return (
    <section aria-label={`Galeria de ${product.title}`} className="min-w-0">
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
