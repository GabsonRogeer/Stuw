import { PRODUCTS } from '@/data/products';
import type { Product } from '@/types';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/config';

export type PublishedProduct = {
  id: number;
  payload: { regular: Product; promotion: Product; saleStart: string; saleEnd: string } | null;
  publish_at: string | null;
  aliases: string[];
};
async function published(): Promise<PublishedProduct[]> {
  if (!isSupabaseConfigured()) return [];
  const { url, key } = getSupabaseConfig();
  const all: PublishedProduct[] = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(
      `${url}/rest/v1/catalog_products?select=*&order=id&limit=1000&offset=${offset}`,
      { headers: { apikey: key }, cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    // During rollout the static catalog remains valid until the migration exists.
    if (response.status === 404) return [];
    if (!response.ok) throw new Error('Não foi possível carregar o catálogo.');
    const rows: PublishedProduct[] = await response.json();
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}
export function mergeCatalog(rows: PublishedProduct[], now = Date.now()): Product[] {
  const ids = new Set(rows.map((r) => r.id));
  return [
    ...PRODUCTS.filter((p) => !ids.has(p.id)),
    ...rows.flatMap((r) => {
      if (!r.payload || (r.publish_at && Date.parse(r.publish_at) > now)) return [];
      const sale = Date.parse(r.payload.saleStart) <= now && now < Date.parse(r.payload.saleEnd);
      return [sale ? r.payload.promotion : r.payload.regular];
    }),
  ];
}

export interface ProductRepository {
  list(): Promise<Product[]>;
  findBySlug(slug: string): Promise<Product | null>;
}
export const productRepository: ProductRepository = {
  async list() {
    return mergeCatalog(await published());
  },
  async findBySlug(slug) {
    const rows = await published();
    const products = mergeCatalog(rows);
    const alias = rows.find((r) => r.aliases.includes(slug));
    return products.find((p) => p.slug === slug || p.id === alias?.id) ?? null;
  },
};
