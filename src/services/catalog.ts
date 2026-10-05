import type { Product } from '@/types';

export type CatalogQuery = {
  categoria?: string;
  colecao?: string;
  cor?: string;
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
  const filtered = products.filter(
    (product) =>
      (!query.categoria ||
        product.category === query.categoria ||
        product.activityCategory === query.categoria) &&
      (!query.colecao || product.collection === query.colecao) &&
      (!query.cor || product.colors.some((color) => color.name === query.cor)) &&
      (!query.tecido || product.fabric === query.tecido) &&
      (!query.ocasiao || product.occasion === query.ocasiao) &&
      (!search ||
        normalize(
          `${product.title} ${product.category} ${product.collection} ${product.activityCategory} ${product.colors.map((color) => color.name).join(' ')} ${product.fabric ?? ''} ${product.feelTag}`,
        ).includes(search)),
  );
  if (query.ordem === 'menor-preco' || query.ordem === 'maior-preco') {
    const direction = query.ordem === 'menor-preco' ? 1 : -1;
    filtered.sort((a, b) => {
      if (a.price === null) return b.price === null ? 0 : 1;
      if (b.price === null) return -1;
      return direction * (a.price - b.price);
    });
  }
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
