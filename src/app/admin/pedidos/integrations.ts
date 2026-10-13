'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { syncOrderPayment, syncOrderShipment } from '@/lib/integrations/checkout';
import { isUuid } from '@/services/orders';

export async function syncOrderIntegration(id: string, labelId?: string) {
  try {
    await requireAdmin();
    if (!isUuid(id) || (labelId && !isUuid(labelId)))
      return { error: 'Confira o ID do pedido e da etiqueta.' };
    const db = createServiceClient();
    const { data, error } = await db
      .from('order_integrations')
      .select('*')
      .eq('order_id', id)
      .single();
    if (error) return { error: 'Integração não encontrada para este pedido.' };
    await syncOrderPayment(id);
    const label = labelId || data.label_id;
    if (label) await syncOrderShipment(id, label);
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath(`/conta/compras/${id}`);
    return { message: 'Pagamento e entrega atualizados.' };
  } catch {
    return {
      error:
        'Não foi possível sincronizar. Confira a conta das integrações, o pagamento e a etiqueta informada.',
    };
  }
}
