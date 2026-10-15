import 'server-only';
import { createClient } from './server';

export async function requireOperation(permission = 'orders') {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Acesso não autorizado.');
  const allowed = await supabase.rpc('operation_allowed', { permission });
  if (allowed.error || allowed.data !== true) throw new Error('Acesso não autorizado.');
  return { supabase, user };
}
