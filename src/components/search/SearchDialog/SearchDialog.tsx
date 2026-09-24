'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search } from 'lucide-react';
import type { Product } from '@/types';
import { queryCatalog } from '@/services/catalog';
import { currency } from '@/lib/commerce';
import { Modal } from '@/components/ui/modal/modal';

export function SearchDialog({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const results = queryCatalog(products, { busca: query }).products;
  return (
    <Modal title="Encontre sua próxima peça" onClose={onClose}>
      <form
        action="/produtos"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(`/produtos?busca=${encodeURIComponent(query.trim())}`);
          onClose();
        }}
        className="flex gap-3"
      >
        <input
          autoFocus
          type="search"
          name="busca"
          className="field"
          placeholder="Busque por peça, tecido ou categoria"
          aria-label="Buscar produtos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" aria-label="Ver resultados" className="p-3">
          <Search size={20} />
        </button>
      </form>
      <p role="status" className="text-xs text-stuw-slate">
        {results.length} peças encontradas
      </p>
      <ul className="space-y-4">
        {results.map((product) => (
          <li key={product.id}>
            <Link
              href={`/produtos/${product.slug}`}
              onClick={onClose}
              className="flex gap-4 items-center"
            >
              <Image
                src={product.image}
                alt={product.title}
                width={50}
                height={68}
                className="w-12 h-16 object-cover"
              />
              <div className="text-xs">
                <p>{product.title}</p>
                <p className="text-stuw-slate mt-1">{currency(product.price)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="text-sm">Tente outro nome ou tecido.</p>}
    </Modal>
  );
}
