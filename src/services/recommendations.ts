import type { Product } from '@/types';

function similarity(candidate: Product, source: Product) {
  return (
    (candidate.category === source.category ? 5 : 0) +
    (source.fabric && candidate.fabric === source.fabric ? 3 : 0) +
    (source.occasion && candidate.occasion === source.occasion ? 2 : 0)
  );
}

export function recommendProducts(
  products: Product[],
  sourceIds: number[],
  excludeIds: number[] = [],
  limit = 4,
): Product[] {
  const sources = [...new Set(sourceIds)]
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));
  const excluded = new Set([...sourceIds, ...excludeIds]);
  return products
    .filter((product) => !excluded.has(product.id))
    .map((product) => ({
      product,
      score: sources.reduce(
        (score, source, index) => score + similarity(product, source) / (index + 1),
        0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.product.id - b.product.id)
    .slice(0, Math.max(0, limit))
    .map(({ product }) => product);
}

// Prefer discoveries, but do not exhaust recommendations when the catalog has
// already been viewed. Only the product currently open is a hard exclusion.
export function recommendFromHistory(
  products: Product[],
  viewedIds: number[],
  currentProductId?: number,
  limit = 4,
): Product[] {
  const sourceIds = [
    ...new Set([...(currentProductId ? [currentProductId] : []), ...viewedIds.slice(0, 5)]),
  ];
  const sources = sourceIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is Product => Boolean(product));
  const viewed = new Set(viewedIds);
  const recent = new Set(viewedIds.filter((id) => id !== currentProductId).slice(0, 4));
  const group = (id: number) => (!viewed.has(id) ? 0 : recent.has(id) ? 2 : 1);
  return products
    .filter((product) => product.id !== currentProductId)
    .map((product) => ({
      product,
      score: sources.reduce(
        (score, source, index) => score + similarity(product, source) / (index + 1),
        0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        group(a.product.id) - group(b.product.id) ||
        b.score - a.score ||
        a.product.id - b.product.id,
    )
    .slice(0, Math.max(0, limit))
    .map(({ product }) => product);
}

export function getComplementaryProduct(
  products: Product[],
  current: Product,
): Product | undefined {
  const complements: Record<string, string[]> = {
    'Tops & Sutiãs': ['Leggings & Calças', 'Tennis & Saias'],
    'Leggings & Calças': ['Tops & Sutiãs'],
    'Tennis & Saias': ['Tops & Sutiãs'],
    Conjuntos: ['Alfaiataria Esportiva', 'Acessórios & Wellness'],
    'Macacões & Bodies': ['Alfaiataria Esportiva', 'Acessórios & Wellness'],
    'Alfaiataria Esportiva': ['Conjuntos', 'Leggings & Calças', 'Macacões & Bodies'],
    'Acessórios & Wellness': ['Conjuntos', 'Leggings & Calças'],
  };
  return products
    .filter(
      (product) =>
        product.id !== current.id && complements[current.category]?.includes(product.category),
    )
    .sort((a, b) => similarity(b, current) - similarity(a, current) || a.id - b.id)[0];
}
