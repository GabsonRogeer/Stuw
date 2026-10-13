import 'server-only';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/config';
import { validateBanner, bannerIsCurrent } from '@/services/banners';
import type { Banner } from '@/types/database';

export async function getPublishedBanners(): Promise<Banner[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { url, key } = getSupabaseConfig();
    const banners: Banner[] = [];
    const now = Date.now();
    for (let offset = 0; ; offset += 1000) {
      const response = await fetch(
        url +
          '/rest/v1/banner_publications?select=*&order=position,created_at,id&limit=1000&offset=' +
          offset,
        {
          headers: { apikey: key },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) return [];
      const rows: Banner[] = await response.json();
      if (!Array.isArray(rows)) return [];
      banners.push(
        ...rows.filter(
          (row) => row && !row.deleted_at && bannerIsCurrent(row, now) && !validateBanner(row),
        ),
      );
      if (rows.length < 1000) return banners;
    }
  } catch {
    return [];
  }
}
