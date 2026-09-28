import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
// The caller must obtain userId from auth.getUser(), never from a form or URL.
export async function loadCheckoutProfile(supabase: SupabaseClient<Database>, userId: string) {
  const [profile, addresses] = await Promise.all([
    supabase.from('profiles').select('full_name,phone').eq('id', userId).maybeSingle(),
    supabase
      .from('addresses')
      .select('id,label,recipient,postal_code,street,number,complement,district,city,state')
      .eq('user_id', userId)
      .order('created_at')
      .order('id'),
  ]);
  return {
    profile: profile.error ? null : profile.data,
    addresses: addresses.error ? [] : (addresses.data ?? []),
    loadError: Boolean(profile.error || addresses.error),
  };
}
