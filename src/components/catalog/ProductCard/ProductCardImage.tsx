'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Product } from '@/types';
import styles from './ProductCardImage.module.css';

export function ProductCardImage({
  product,
  priority = false,
}: {
  product: Pick<Product, 'image' | 'hoverImage' | 'title'>;
  priority?: boolean;
}) {
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const reverse = product.hoverImage;
  const hasReverse = reverse && reverse !== product.image && reverse !== failedSource;
  const sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw';

  return (
    <span className={styles.media} data-ready={Boolean(hasReverse && loadedSource === reverse)}>
      <Image
        src={product.image}
        alt={product.title}
        fill
        priority={priority}
        sizes={sizes}
        className={`${styles.front} object-cover object-top`}
      />
      {hasReverse && (
        <Image
          key={reverse}
          src={reverse}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          onLoad={() => setLoadedSource(reverse)}
          onError={() => setFailedSource(reverse)}
          className={`${styles.reverse} object-cover object-top bg-stuw-sand dark:bg-stone-900`}
        />
      )}
    </span>
  );
}
