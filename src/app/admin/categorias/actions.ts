'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { validateCategory, type CategoryInput } from '@/services/categories';

type Result = { error?: string; success?: string };
const validIdentity = (id: number, revision: number) =>
  Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(revision) && revision > 0;

export async function saveCategory(
  input: CategoryInput,
  id?: number,
  revision?: number,
): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    const invalid = validateCategory(input);
    if (invalid) return { error: invalid };
    if (id !== undefined && !validIdentity(id, revision!))
      return { error: 'Cadastro inválido. Atualize a página.' };
    const label = input.label.trim();
    const result =
      id === undefined
        ? await supabase
            .from('product_categories')
            .insert({ kind: input.kind, label, value: label, position: input.position })
            .select('id')
            .single()
        : await supabase
            .from('product_categories')
            .update({ label, position: input.position })
            .eq('id', id)
            .eq('revision', revision!)
            .select('id')
            .maybeSingle();
    if (result.error?.code === '23505')
      return { error: 'Já existe uma categoria com esse nome. Confira também as arquivadas.' };
    if (result.error) return { error: 'Não foi possível salvar a categoria. Tente novamente.' };
    if (!result.data)
      return { error: 'Outra sessão alterou esta categoria. Atualize a página antes de salvar.' };
    revalidatePath('/', 'layout');
    return { success: id === undefined ? 'Categoria adicionada.' : 'Categoria atualizada.' };
  } catch {
    return { error: 'Verifique sua conexão e seu acesso administrativo.' };
  }
}

export async function setCategoryArchived(
  id: number,
  revision: number,
  archived: boolean,
): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!validIdentity(id, revision) || typeof archived !== 'boolean')
      return { error: 'Categoria inválida.' };
    const { data, error } = await supabase
      .from('product_categories')
      .update({ archived })
      .eq('id', id)
      .eq('revision', revision)
      .select('id')
      .maybeSingle();
    if (error) return { error: 'Não foi possível alterar a categoria. Tente novamente.' };
    if (!data) return { error: 'Outra sessão alterou esta categoria. Atualize a página.' };
    revalidatePath('/', 'layout');
    return {
      success: archived
        ? 'Categoria arquivada. Os produtos foram preservados.'
        : 'Categoria restaurada.',
    };
  } catch {
    return { error: 'Verifique sua conexão e seu acesso administrativo.' };
  }
}
