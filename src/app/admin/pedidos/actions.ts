'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { isUuid, ORDER_LABELS } from '@/services/orders';
export type OrderState = { error?: string; message?: string };
export async function updateOrder(_state: OrderState, form: FormData): Promise<OrderState> {
  try {
    const { supabase } = await requireAdmin();
    const id = String(form.get('id') ?? '');
    const status = String(form.get('status') ?? '');
    const revision = Number(form.get('revision'));
    const carrier = String(form.get('carrier') ?? '').trim();
    const tracking = String(form.get('tracking') ?? '').trim();
    if (
      !isUuid(id) ||
      !Object.hasOwn(ORDER_LABELS, status) ||
      !Number.isInteger(revision) ||
      revision < 0 ||
      carrier.length > 100 ||
      tracking.length > 100
    )
      return { error: 'Confira os dados do pedido.' };
    if (['shipped', 'delivered'].includes(status) && (!carrier || !tracking))
      return { error: 'Informe a transportadora e o código de rastreio.' };
    const { error } = await supabase.rpc('update_order', {
      input_id: id,
      expected_revision: revision,
      next_status: status,
      input_carrier: carrier,
      input_tracking: tracking,
    });
    if (error?.message === 'Order changed')
      return {
        error:
          'Outro administrador alterou este pedido. Atualize a página antes de tentar novamente.',
      };
    if (error)
      return { error: 'Não foi possível atualizar. Confira o status e atualize a página.' };
    revalidatePath('/admin/pedidos');
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath('/conta/compras');
    revalidatePath(`/conta/compras/${id}`);
    return { message: 'Pedido atualizado.' };
  } catch {
    return { error: 'Não foi possível concluir. Verifique seu acesso administrativo.' };
  }
}
