import 'server-only';
import { createClient } from './server';
import { connection } from 'next/server';
export async function getWholesaleSettings() {
  await connection();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('wholesale_settings')
      .select('*')
      .eq('id', true)
      .single();
    return error ? null : data;
  } catch {
    return null;
  }
}
