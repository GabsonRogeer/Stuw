'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWholesale } from '@/providers/wholesale-provider';
import type { WholesaleProduct } from '@/services/wholesale';
function WholesaleCard({ product }: { product: WholesaleProduct }) {
  const { add, ready } = useWholesale();
  const [size, setSize] = useState(product.sizes[0] ?? '');
  const [color, setColor] = useState(product.colors[0]?.name ?? '');
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState('');
  return (
    <article className="min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden bg-stuw-sand group rounded-lg">
        <Image
          src={product.image}
          alt={product.title}
          fill
          sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"
          className="object-cover"
        />
        {product.hoverImage && (
          <Image
            src={product.hoverImage}
            alt={`${product.title} — costas`}
            fill
            sizes="(min-width:1024px) 25vw, 50vw"
            className="object-cover opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
      </div>
      <h2 className="font-medium mt-4">{product.title}</h2>
      <p className="text-xs text-stuw-slate mt-1">{product.category}</p>
      <form
        className="space-y-3 mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(
            add(product, size, color, qty)
              ? 'Adicionado à lista de cotação.'
              : 'Limite de 50 variantes e 9.999 peças por variante.',
          );
        }}
      >
        <label className="block text-xs">
          Cor
          <select className="field mt-1" value={color} onChange={(e) => setColor(e.target.value)}>
            {product.colors.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">
            Tamanho
            <select className="field mt-1" value={size} onChange={(e) => setSize(e.target.value)}>
              {product.sizes.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Quantidade
            <input
              className="field mt-1"
              type="number"
              min={1}
              max={9999}
              required
              value={qty || ''}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </label>
        </div>
        <button
          disabled={!ready}
          className="w-full border border-current rounded-md py-3 text-xs disabled:opacity-50"
        >
          Adicionar à cotação
        </button>
        <p role="status" className="text-xs min-h-4">
          {message}
        </p>
      </form>
    </article>
  );
}
export function WholesaleCatalog({
  products,
  minimum,
}: {
  products: WholesaleProduct[];
  minimum: number | null;
}) {
  const { count } = useWholesale();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const normalize = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const filtered = products.filter(
    (p) =>
      (!category || p.category === category) &&
      normalize(p.title + ' ' + p.description).includes(normalize(search)),
  );
  return (
    <>
      <div className="sticky top-20 z-20 bg-stuw-canvas dark:bg-stuw-obsidian border rounded-lg p-4 mb-8 flex flex-wrap justify-between gap-4 text-sm">
        <p>
          {minimum === null
            ? 'Cotação temporariamente indisponível.'
            : `Mínimo: ${minimum} peça(s) no total.`}
        </p>
        <Link className="underline font-medium" href="/atacado/cotacao">
          Minha cotação ({count} peças)
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <label className="text-xs">
          Buscar peças
          <input
            className="field mt-2"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="text-xs">
          Categoria
          <select
            className="field mt-2"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as categorias</option>
            {[...new Set(products.map((p) => p.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {!filtered.length && <p className="py-10">Nenhuma peça encontrada.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.slice((page - 1) * 12, page * 12).map((p) => (
          <WholesaleCard key={p.id} product={p} />
        ))}
      </div>
      {filtered.length > 12 && (
        <nav aria-label="Páginas do atacado" className="flex justify-between mt-8">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>Página {page}</span>
          <button disabled={page * 12 >= filtered.length} onClick={() => setPage(page + 1)}>
            Próxima
          </button>
        </nav>
      )}
    </>
  );
}
