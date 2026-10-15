'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { getProducts } from '@/services/product-service';
import {
  defaultCompleteLook,
  validateCompleteLook,
  type CompleteLookSettings,
} from '@/services/complete-look';

export async function saveCompleteLook(
  form: FormData,
): Promise<{ error?: string; settings?: CompleteLookSettings }> {
  try {
    const { supabase } = await requireAdmin();
    const revision = Number(form.get('revision'));
    if (!Number.isSafeInteger(revision) || revision < 1)
      return { error: 'Recarregue a página antes de salvar.' };
    const value = {
      enabled: form.get('enabled') === 'true',
      product_id: form.get('product_id') ? Number(form.get('product_id')) : null,
      image: String(form.get('image') ?? ''),
      eyebrow: String(form.get('eyebrow') ?? '').trim(),
      title: String(form.get('title') ?? '').trim(),
      accent: String(form.get('accent') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      button_label: String(form.get('button_label') ?? '').trim(),
    };
    const invalid = validateCompleteLook({ ...defaultCompleteLook, ...value }, await getProducts());
    if (invalid) return { error: invalid };
    const { data, error } = await supabase
      .from('complete_look_settings')
      .update(value)
      .eq('id', 'home')
      .eq('revision', revision)
      .select('*')
      .maybeSingle();
    if (error) return { error: 'Não foi possível salvar a seção.' };
    if (!data)
      return { error: 'A seção foi alterada em outra sessão. Recarregue antes de salvar.' };
    revalidatePath('/');
    revalidatePath('/admin/look-completo');
    return { settings: data };
  } catch {
    return { error: 'Não foi possível salvar. Confira sua conexão e seu acesso administrativo.' };
  }
}
