'use client';

import Link from 'next/link';
import Image from 'next/image';
import { X } from 'lucide-react';
import type { Product } from '@/types';
import { useWishlist } from '@/providers/wishlist-provider';
import { currency } from '@/lib/commerce';
import { Modal } from '@/components/ui/modal/modal';

export function WishlistDialog({
  products,
  onClose,
}: {
  products: Product[];
  onClose: () => void;
}) {
  const { ids, toggle } = useWishlist();
  const saved = products.filter((product) => ids.includes(product.id));
  return (
    <Modal title="Seus favoritos" onClose={onClose}>
      {saved.length === 0 ? (
        <div className="text-sm space-y-4">
          <p>Guarde aqui as peças que você ama.</p>
          <Link href="/produtos" onClick={onClose} className="underline">
            Explorar coleção
          </Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {saved.map((product) => (
            <li key={product.id} className="flex items-center gap-3">
              <Link
                href={`/produtos/${product.slug}`}
                onClick={onClose}
                className="flex flex-1 items-center gap-4"
              >
                <Image
                  src={product.image}
                  alt={product.title}
                  width={64}
                  height={85}
                  className="w-16 h-20 object-cover"
                />
                <div className="text-xs">
                  <p>{product.title}</p>
                  <p className="mt-2 text-stuw-slate">
                    {product.price === null ? 'Em breve' : currency(product.price)}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => toggle(product.id)}
                aria-label={`Remover ${product.title} dos favoritos`}
                className="p-2"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
