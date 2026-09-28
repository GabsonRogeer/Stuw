import 'server-only';
import { redirect } from 'next/navigation';
import { requireAdmin } from './admin';
export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch {
    redirect('/conta');
  }
}
