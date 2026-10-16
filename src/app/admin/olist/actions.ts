'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { createServiceClient } from '@/lib/supabase/service';
import { processOlistInvoice } from '@/lib/integrations/olist-invoices';

export async function changeInvoice(form: FormData): Promise<{ error?: string; message?: string }> {
  try {
    const { user } = await requireAdmin();
    const id = String(form.get('orderId') ?? '');
    const operation = String(form.get('operation') ?? '');
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      !['generate', 'emit', 'refresh', 'retry'].includes(operation)
    )
      return { error: 'Pedido ou operação inválida.' };
    if (operation !== 'refresh' && form.get('reviewed') !== 'on')
      return { error: 'Confira a operação fiscal antes de continuar.' };
    if (operation === 'retry') {
      const resumed = await createServiceClient()
        .from('olist_invoice_jobs')
        .update({
          status: 'pending',
          automation_attempts: 0,
          validated_skus: [],
          next_attempt_at: new Date().toISOString(),
          last_error: `Retomada após revisão pelo administrador ${user.id}.`,
        })
        .eq('order_id', id)
        .eq('automatic', true)
        .eq('status', 'blocked')
        .is('lease_owner', null)
        .select('order_id')
        .maybeSingle();
      if (resumed.error || !resumed.data)
        return { error: 'A retomada exige uma pendência automática sem execução em andamento.' };
      revalidatePath('/admin/olist');
      return {
        message: 'Consultas retomadas. Tentativas fiscais anteriores serão apenas consultadas.',
      };
    }
    const result = await processOlistInvoice(
      id,
      user.id,
      operation as 'generate' | 'emit' | 'refresh',
    );
    revalidatePath('/admin/olist');
    const labels = {
      authorized: 'NF autorizada na Olist.',
      generated: 'NF gerada. Confira os dados fiscais na Olist antes de solicitar a emissão.',
      processing: 'Emissão em processamento. Consulte novamente.',
      blocked: 'Nota com pendência, cancelamento ou rejeição. Revise na Olist.',
    };
    return { message: `${labels[result.status]} ID Olist: ${result.invoiceId}.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Não foi possível processar o faturamento.',
    };
  }
}

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
