import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './server';
export async function requireAccount() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  return { supabase, user };
}
