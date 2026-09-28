'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { validOrderRequest, type OrderRequest } from '@/services/orders';
export async function placeOrder(request: OrderRequest) {
  if (!validOrderRequest(request))
    return { error: 'Revise os dados do pedido antes de continuar.' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { error: 'Entre na sua conta para salvar o pedido.', loginRequired: true };
    // The demo does not issue invoices: validate CPF/CNPJ, but do not persist it.
    const { taxDocument: _document, ...payload } = request;
    void _document;
    const { data: id, error } = await supabase.rpc('create_demo_order', { request: payload });
    if (error || !id) {
      if (error?.message === 'Coupon unavailable')
        return { error: 'O cupom expirou ou atingiu o limite. Remova-o e revise o total.' };
      if (error?.message === 'Total changed')
        return {
          error: 'Os valores mudaram. Atualize o carrinho e revise o total antes de continuar.',
        };
      return {
        error: 'Não foi possível salvar o pedido. Sua sacola foi mantida. Tente novamente.',
      };
    }
    const { data: order, error: readError } = await supabase
      .from('orders')
      .select('id,number,total_cents')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (readError || !order)
      return {
        error:
          'Não foi possível confirmar o registro. Tente novamente; o pedido não será duplicado.',
      };
    revalidatePath('/conta/compras');
    revalidatePath('/admin/pedidos');
    revalidatePath('/admin/cupons');
    return { order: { id: order.id, code: order.number, total: order.total_cents / 100 } };
  } catch {
    return { error: 'Falha de conexão. Tente novamente; sua sacola foi mantida.' };
  }
}
