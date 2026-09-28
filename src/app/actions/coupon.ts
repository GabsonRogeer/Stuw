'use server';
import { createClient } from '@/lib/supabase/server';
import type { AppliedCoupon } from '@/services/coupons';
export async function validateCoupon(
  code: string,
): Promise<{ coupon?: AppliedCoupon; error?: string }> {
  if (typeof code !== 'string' || !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code.trim().toUpperCase()))
    return { error: 'Cupom inválido.' };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('lookup_coupon', {
      input_code: code.trim().toUpperCase(),
    });
    if (error) return { error: 'Não foi possível validar o cupom agora. Tente novamente.' };
    if (!data?.length)
      return { error: 'Cupom inválido, inativo, expirado ou com limite atingido.' };
    return { coupon: data[0] };
  } catch {
    return { error: 'Não foi possível validar o cupom agora. Tente novamente.' };
  }
}
