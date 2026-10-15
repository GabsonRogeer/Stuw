import 'server-only';
import { redirect } from 'next/navigation';
import { requireOperation } from './operations';
export async function requireOperationPage() {
  try {
    return await requireOperation();
  } catch {
    redirect('/conta');
  }
}
