'use server';
import { revalidatePath } from 'next/cache';
import { requireOperation } from '@/lib/supabase/operations';
import { syncOrderPayment } from '@/lib/integrations/checkout';
import { isUuid } from '@/services/orders';

export type OperationResult = { error?: string; message?: string };
export async function operationalAction(
  _: OperationResult,
  form: FormData,
): Promise<OperationResult> {
  const value = (name: string) => String(form.get(name) ?? '').trim();
  const action = value('action');
  const permissions: Record<string, string> = {
    stage: 'fulfill',
    return: 'returns',
    staff: 'team',
    payment: 'finance',
  };
  if (!permissions[action]) return { error: 'Operação inválida.' };
  try {
    const { supabase } = await requireOperation(permissions[action]);
    const id = value('order');
    if (action !== 'staff' && !isUuid(id)) return { error: 'Pedido inválido.' };
    let error: { message: string } | null = null;
    if (action === 'payment') {
      await syncOrderPayment(id);
    } else if (action === 'staff') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email')) || value('email').length > 254)
        return { error: 'Informe o e-mail da conta do colaborador.' };
      ({ error } = await supabase.rpc('set_operation_staff_email', {
        input_email: value('email'),
        input_role: value('role'),
        input_active: value('active') === 'true',
      }));
    } else {
      const revision = Number(value('revision'));
      const note = value('note');
      if (!Number.isSafeInteger(revision) || revision < 0 || note.length < 5 || note.length > 500)
        return { error: 'Informe uma observação de 5 a 500 caracteres.' };
      if (action === 'stage') {
        ({ error } = await supabase.rpc('change_operation', {
          input_order: id,
          expected_revision: revision,
          next_stage: value('stage'),
          input_note: note,
        }));
      } else {
        const returnId = value('return_id');
        const item = Number(value('item'));
        const quantity = Number(value('quantity'));
        if (
          (returnId && !isUuid(returnId)) ||
          !isUuid(value('key')) ||
          !Number.isSafeInteger(item) ||
          !Number.isSafeInteger(quantity)
        )
          return { error: 'Confira o item e a quantidade.' };
        ({ error } = await supabase.rpc('manage_return', {
          input_order: id,
          input_id: returnId || null,
          request_key: value('key'),
          item_index: item,
          quantity,
          kind: value('kind'),
          next_status: value('stage'),
          expected_revision: revision,
          note,
          details: {
            inspection: value('inspection'),
            stock_disposition: value('stock_disposition'),
            stock_reference: value('stock_reference'),
            settlement_reference: value('settlement_reference'),
          },
        }));
      }
    }
    if (error) {
      const messages: Record<string, string> = {
        'Revision conflict': 'Este registro mudou. Atualize a página antes de salvar.',
        'Approved payment required': 'É necessário pagamento aprovado para preparar o pedido.',
        'Invoice confirmation required':
          'A nota precisa estar vinculada ao pedido na integração Olist.',
        'Shipment confirmation required':
          'Confirme a postagem e o rastreio na integração de entrega.',
        'Invalid transition': 'Esta mudança de etapa não é permitida.',
        'Quantity exceeds purchased':
          'A quantidade ultrapassa os itens disponíveis para troca/devolução.',
        'Shipped order required': 'Trocas e devoluções exigem um pedido já enviado.',
        'Existing administrator':
          'Esta conta já é administradora. O perfil operacional não substitui esse acesso.',
        'Staff account not found':
          'Nenhuma conta encontrada com esse e-mail. O colaborador precisa se cadastrar primeiro.',
        'Request conflict':
          'Esta solicitação já foi registrada com outros dados. Atualize a página.',
        'Inspection required': 'Informe o resultado da conferência da peça.',
        'Resolution evidence required':
          'Informe a destinação do estoque e os comprovantes de conclusão. Peças danificadas não retornam ao estoque vendável.',
      };
      return {
        error:
          messages[error.message] ?? 'Não foi possível salvar. Confira os dados e sua permissão.',
      };
    }
    revalidatePath('/operacao', 'layout');
    if (id) {
      revalidatePath(`/admin/pedidos/${id}`);
      revalidatePath(`/conta/compras/${id}`);
    }
    return { message: 'Operação registrada.' };
  } catch {
    return { error: 'Não foi possível concluir. Verifique seu acesso e tente novamente.' };
  }
}
