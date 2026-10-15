'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { createServiceClient } from '@/lib/supabase/service';

export async function confirmInventoryMovement(form: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const id = String(form.get('orderId') ?? '');
  const proof = String(form.get('proof') ?? '').trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
    proof.length < 10 ||
    proof.length > 400 ||
    form.get('verified') !== 'on'
  )
    throw new Error('Informe o pedido e a referência do movimento de estoque conferido na Olist.');
  const result = await createServiceClient().rpc('confirm_olist_inventory', {
    input_order: id,
    proof: `${proof} | Administrador: ${user.id}`,
  });
  if (result.error)
    throw new Error(
      'Não foi possível confirmar. Confira se o pedido real está aprovado e vinculado.',
    );
  revalidatePath('/admin/olist');
}
