import 'server-only';

import { createClient } from './server';

// Call inside every future administrative page, action and route handler.
// The database remains the source of permission; user metadata is never trusted.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Autenticação necessária.');

  const { data: isAdmin, error: permissionError } = await supabase.rpc('is_admin');
  if (permissionError || !isAdmin) throw new Error('Acesso administrativo não autorizado.');

  return { supabase, user: data.user };
}

export async function requireSuperAdmin() {
  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase.rpc('is_super_admin');
  if (error || data !== true) throw new Error('Acesso de super admin não autorizado.');
  return { supabase, user };
}
