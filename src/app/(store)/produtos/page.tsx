import type { Metadata } from 'next';
import Link from 'next/link';
import { getProducts } from '@/services/product-service';
import { queryCatalog, type CatalogQuery } from '@/services/catalog';
import { ProductGrid } from '@/components/catalog/ProductGrid/ProductGrid';
import { CatalogFilters } from '@/components/catalog/CatalogFilters/CatalogFilters';

export const metadata: Metadata = {
  title: 'Coleção',
  description: 'Descubra as peças STUW por categoria, tecido ou ocasião.',
};
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query: CatalogQuery = {};
  for (const key of [
    'categoria',
    'colecao',
    'cor',
    'tecido',
    'ocasiao',
    'busca',
    'ordem',
    'pagina',
  ] as const) {
    const value = params[key];
    if (typeof value === 'string') query[key] = value;
  }
  const products = await getProducts();
  const result = queryCatalog(products, query);
  return (
    <div className="page-container py-10 sm:py-14">
      <div className="text-center mb-10">
        <p className="eyebrow mb-3">Activewear & Wellness</p>
        <h1 className="font-serif text-4xl sm:text-5xl">A coleção STUW</h1>
      </div>
      <CatalogFilters key={JSON.stringify(query)} query={query} products={products} />
      <p className="text-xs text-stuw-slate mb-6" role="status">
        {result.total} peças{query.busca ? ` para “${query.busca}”` : ''}
      </p>
      {result.products.length ? (
        <ProductGrid products={result.products} />
      ) : (
        <div className="text-center py-20 space-y-5">
          <h2 className="font-serif text-2xl">Nenhuma peça nesta seleção.</h2>
          <Link href="/produtos" className="text-xs underline">
            Ver toda a coleção
          </Link>
        </div>
      )}
      {result.pages > 1 && (
        <nav aria-label="Paginação" className="flex justify-center gap-3 mt-12">
          {Array.from({ length: result.pages }, (_, index) => index + 1).map((page) => (
            <Link
              key={page}
              aria-current={page === result.page ? 'page' : undefined}
              className={`px-4 py-2 border ${page === result.page ? 'border-current' : 'border-transparent'}`}
              href={`/produtos?${new URLSearchParams({ ...query, pagina: String(page) })}`}
            >
              {page}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
