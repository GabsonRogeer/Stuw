'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { parseCoupon } from '@/services/coupons';
export type CouponState = { error?: string; message?: string };
export async function saveCoupon(_state: CouponState, form: FormData): Promise<CouponState> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = parseCoupon(form);
    if (!parsed.value) return { error: parsed.error };
    const id = String(form.get('id') ?? '');
    const query = id
      ? supabase.from('coupons').update(parsed.value).eq('id', id)
      : supabase.from('coupons').insert(parsed.value);
    const { data, error } = await query.select('id').maybeSingle();
    if (error?.code === '23505') return { error: 'Já existe um cupom com esse código.' };
    if (error?.code === '23514')
      return {
        error:
          'Confira os valores. Use 0 para ilimitado ou um limite igual ou maior que a quantidade já utilizada.',
      };
    if (error || !data) return { error: 'Não foi possível salvar o cupom. Tente novamente.' };
    revalidatePath('/admin/cupons');
    return { message: id ? 'Cupom atualizado.' : 'Cupom cadastrado.' };
  } catch {
    return { error: 'Não foi possível concluir. Verifique seu acesso administrativo.' };
  }
}
export async function toggleCoupon(_state: CouponState, form: FormData): Promise<CouponState> {
  try {
    const { supabase } = await requireAdmin();
    const active = form.get('active') === 'true';
    const id = String(form.get('id') ?? '');
    if (active) {
      const { data, error } = await supabase
        .from('coupons')
        .select('expires_at,used_count,max_uses')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return { error: 'Não foi possível consultar o cupom.' };
      if (
        Date.parse(data.expires_at) <= Date.now() ||
        (data.max_uses > 0 && data.used_count >= data.max_uses)
      )
        return { error: 'Edite a validade ou o limite de usos antes de reativar este cupom.' };
    }
    const { data, error } = await supabase
      .from('coupons')
      .update({ active })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error || !data) return { error: 'Não foi possível alterar o status.' };
    revalidatePath('/admin/cupons');
    return { message: active ? 'Cupom reativado.' : 'Cupom desativado.' };
  } catch {
    return { error: 'Não foi possível concluir. Verifique seu acesso administrativo.' };
  }
}
