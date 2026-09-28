'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/services/orders';
import { validWholesaleContact } from '@/services/wholesale';
export async function createQuote(request: {
  key: string;
  name: string;
  phone: string;
  company: string;
  cnpj: string;
  notes: string;
  items: { id: number; size: string; color: string; qty: number }[];
}) {
  try {
    if (
      !request ||
      !isUuid(request.key) ||
      !Array.isArray(request.items) ||
      request.items.length < 1 ||
      request.items.length > 50
    )
      return { error: 'Revise sua lista de cotação.' };
    const contact = {
      name: String(request.name ?? '').trim(),
      phone: String(request.phone ?? '').replace(/\D/g, ''),
      company: String(request.company ?? '').trim(),
      cnpj: String(request.cnpj ?? '')
        .toUpperCase()
        .replace(/[.\/\-\s]/g, ''),
      notes: String(request.notes ?? '').trim(),
    };
    const invalid = validWholesaleContact(contact);
    if (invalid) return { error: invalid };
    const items = request.items.map(({ id, size, color, qty }) => ({ id, size, color, qty }));
    if (
      items.some(
        (i) =>
          !Number.isInteger(i.id) ||
          typeof i.size !== 'string' ||
          i.size.length > 50 ||
          typeof i.color !== 'string' ||
          i.color.length > 100 ||
          !Number.isInteger(i.qty) ||
          i.qty < 1 ||
          i.qty > 9999,
      )
    )
      return { error: 'Confira as variantes e quantidades.' };
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { error: 'Sua sessão expirou. Entre na conta novamente.', loginRequired: true };
    const { data: id, error } = await supabase.rpc('create_wholesale_quote', {
      request: { key: request.key, ...contact, items },
    });
    if (error || !id) {
      const minimum = error?.message.match(/^Minimum quantity: (\d+)$/)?.[1];
      if (minimum)
        return { error: `A quantidade mínima atual é ${minimum} peças. Ajuste sua lista.` };
      if (error?.message === 'Invalid variant')
        return { error: 'Uma variante não está mais disponível. Revise a lista no catálogo.' };
      return {
        error: 'Não foi possível registrar a cotação. Sua lista foi mantida; tente novamente.',
      };
    }
    revalidatePath('/conta/cotacoes');
    revalidatePath('/admin/atacado');
    return { id };
  } catch {
    return { error: 'Falha ao registrar. Tente novamente; sua lista foi mantida.' };
  }
}
