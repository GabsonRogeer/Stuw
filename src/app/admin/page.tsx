import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/supabase/admin-page';
export default async function AdminPage() {
  await requireAdminPage();
  redirect('/admin/cupons');
}
