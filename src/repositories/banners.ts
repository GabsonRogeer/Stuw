import 'server-only';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/config';
import { validateBanner } from '@/services/banners';
import type { Banner } from '@/types/database';
export async function getPublishedBanner(): Promise<Banner | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { url, key } = getSupabaseConfig();
    const response = await fetch(url + '/rest/v1/site_banners?slot=eq.home&select=*', {
      headers: { apikey: key },
      next: { revalidate: 60, tags: ['home-banner'] },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const row = rows?.[0];
    if (
      !row ||
      typeof row.title !== 'string' ||
      typeof row.link !== 'string' ||
      typeof row.desktop_path !== 'string' ||
      typeof row.mobile_path !== 'string' ||
      validateBanner(row)
    )
      return null;
    return row;
  } catch {
    return null;
  }
}
