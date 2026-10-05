import { PRODUCTS } from '@/data/products';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/config';

/** Resolve existence and canonical slug before streaming, without loading catalog content. */
export async function resolveProductRoute(slug: string): Promise<string | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) return null;
  const legacy = PRODUCTS.find((p) => p.slug === slug);
  if (!isSupabaseConfigured()) return legacy?.slug ?? null;
  const { url, key } = getSupabaseConfig();
  const query = new URLSearchParams({
    select: 'id,publish_at,slug:payload->regular->>slug',
    or: `(payload->regular->>slug.eq.${slug},aliases.cs.{${slug}}${legacy ? `,id.eq.${legacy.id}` : ''})`,
    limit: '1',
  });
  const response = await fetch(`${url}/rest/v1/catalog_products?${query}`, {
    headers: { apikey: key },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return legacy?.slug ?? null;
  if (!response.ok) throw new Error('Catálogo indisponível.');
  const [row] = await response.json();
  if (!row) return legacy?.slug ?? null;
  if (!row.slug || (row.publish_at && Date.parse(row.publish_at) > Date.now())) return null;
  return row.slug;
}
