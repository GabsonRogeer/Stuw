'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { isUuid } from '@/services/orders';
import { QUOTE_LABELS } from '@/services/wholesale';
export type WholesaleState = { error?: string; message?: string };
export async function saveWholesaleSettings(
  _state: WholesaleState,
  form: FormData,
): Promise<WholesaleState> {
  try {
    const { supabase } = await requireAdmin();
    const raw = String(form.get('minimum') ?? '').trim();
    const minimum = Number(raw);
    const phone = String(form.get('whatsapp') ?? '').replace(/[\s()+-]/g, '');
    if (!raw || !Number.isInteger(minimum) || minimum < 1 || minimum > 100000)
      return { error: 'Informe uma quantidade mínima entre 1 e 100.000 peças.' };
    if (phone && !/^[1-9]\d{9,14}$/.test(phone))
      return { error: 'Informe o WhatsApp com código do país e DDD, apenas números.' };
    const { data, error } = await supabase
      .from('wholesale_settings')
      .update({ minimum_quantity: minimum, whatsapp_number: phone })
      .eq('id', true)
      .select('id')
      .maybeSingle();
    if (error || !data)
      return { error: 'Não foi possível salvar. Verifique se a migração do atacado foi aplicada.' };
    revalidatePath('/admin/atacado');
    revalidatePath('/atacado');
    revalidatePath('/atacado/cotacao');
    revalidatePath('/conta/cotacoes/[id]', 'page');
    return { message: 'Configuração atualizada.' };
  } catch {
    return { error: 'Não foi possível concluir. Verifique seu acesso administrativo.' };
  }
}
export async function updateQuote(_state: WholesaleState, form: FormData): Promise<WholesaleState> {
  try {
    const { supabase } = await requireAdmin();
    const id = String(form.get('id') ?? '');
    const revision = Number(form.get('revision'));
    const status = String(form.get('status') ?? '');
    const note = String(form.get('note') ?? '').trim();
    if (
      !isUuid(id) ||
      !Number.isInteger(revision) ||
      revision < 0 ||
      !Object.hasOwn(QUOTE_LABELS, status) ||
      note.length > 500
    )
      return { error: 'Confira os dados da atualização.' };
    const { error } = await supabase.rpc('update_wholesale_quote', {
      input_id: id,
      expected_revision: revision,
      next_status: status,
      input_note: note,
    });
    if (error?.message === 'Quote changed')
      return { error: 'A cotação foi alterada por outro administrador. Atualize a página.' };
    if (error)
      return {
        error: 'Não foi possível atualizar este status. Atualize a página e tente novamente.',
      };
    revalidatePath('/admin/atacado');
    revalidatePath(`/admin/atacado/${id}`);
    revalidatePath('/conta/cotacoes');
    revalidatePath(`/conta/cotacoes/${id}`);
    return { message: 'Cotação atualizada.' };
  } catch {
    return { error: 'Não foi possível concluir. Verifique seu acesso administrativo.' };
  }
}
