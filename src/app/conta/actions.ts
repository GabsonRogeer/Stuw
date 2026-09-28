'use server';
import { revalidatePath } from 'next/cache';
import { requireAccount } from '@/lib/supabase/account';
import { validateProfile, validateAddress, type AddressInput } from '@/services/account';
export type AccountState = { error?: string; message?: string };
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
export async function saveProfile(_state: AccountState, form: FormData): Promise<AccountState> {
  const { supabase, user } = await requireAccount();
  const full_name = text(form, 'full_name');
  const birth_date = text(form, 'birth_date');
  const phone = text(form, 'phone').replace(/\D/g, '');
  const invalid = validateProfile(full_name, birth_date, phone);
  if (invalid) return { error: invalid };
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name, birth_date: birth_date || null, phone: phone || null })
    .eq('id', user.id)
    .select('id')
    .maybeSingle();
  if (error || !data) return { error: 'Não foi possível salvar seus dados. Tente novamente.' };
  revalidatePath('/conta', 'layout');
  return { message: 'Dados pessoais atualizados.' };
}
export async function saveAddress(_state: AccountState, form: FormData): Promise<AccountState> {
  const { supabase, user } = await requireAccount();
  const address = Object.fromEntries(
    [
      'label',
      'recipient',
      'postal_code',
      'street',
      'number',
      'complement',
      'district',
      'city',
      'state',
    ].map((key) => [key, text(form, key)]),
  ) as AddressInput;
  address.postal_code = address.postal_code.replace(/\D/g, '');
  const invalid = validateAddress(address);
  if (invalid) return { error: invalid };
  const id = text(form, 'id');
  const query = id
    ? supabase.from('addresses').update(address).eq('id', id).eq('user_id', user.id)
    : supabase.from('addresses').insert({ ...address, user_id: user.id });
  const { data, error } = await query.select('id').maybeSingle();
  if (error || !data) return { error: 'Não foi possível salvar o endereço. Tente novamente.' };
  revalidatePath('/conta/enderecos');
  return { message: id ? 'Endereço atualizado.' : 'Endereço adicionado.' };
}
export async function deleteAddress(_state: AccountState, form: FormData): Promise<AccountState> {
  const { supabase, user } = await requireAccount();
  const { data, error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', text(form, 'id'))
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();
  if (error || !data) return { error: 'Não foi possível excluir o endereço.' };
  revalidatePath('/conta/enderecos');
  return { message: 'Endereço excluído.' };
}
