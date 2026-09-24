import type { Product } from '@/types';

export type CatalogQuery = {
  categoria?: string;
  tecido?: string;
  ocasiao?: string;
  busca?: string;
  ordem?: string;
  pagina?: string;
};
export const PAGE_SIZE = 12;
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function queryCatalog(products: Product[], query: CatalogQuery) {
  const search = normalize(query.busca?.trim() ?? '');
  let filtered = products.filter(
    (product) =>
      (!query.categoria || product.category === query.categoria) &&
      (!query.tecido || product.fabric === query.tecido) &&
      (!query.ocasiao || product.occasion === query.ocasiao) &&
      (!search ||
        normalize(
          `${product.title} ${product.category} ${product.fabric} ${product.feelTag}`,
        ).includes(search)),
  );
  if (query.ordem === 'menor-preco') filtered = filtered.sort((a, b) => a.price - b.price);
  if (query.ordem === 'maior-preco') filtered = filtered.sort((a, b) => b.price - a.price);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requested = Number(query.pagina);
  const page = Math.min(pages, Number.isInteger(requested) && requested > 0 ? requested : 1);
  return {
    products: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: filtered.length,
    page,
    pages,
  };
}
