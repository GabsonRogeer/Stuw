import 'server-only';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/config';
import { defaultCompleteLook, type CompleteLookSettings } from '@/services/complete-look';

export async function getCompleteLook(): Promise<CompleteLookSettings> {
  if (!isSupabaseConfigured()) return defaultCompleteLook;
  try {
    const { url, key } = getSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/complete_look_settings?id=eq.home&select=*`, {
      headers: { apikey: key },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ...defaultCompleteLook, enabled: false };
    const rows: CompleteLookSettings[] = await response.json();
    return rows[0] ?? { ...defaultCompleteLook, enabled: false };
  } catch {
    return { ...defaultCompleteLook, enabled: false };
  }
}
