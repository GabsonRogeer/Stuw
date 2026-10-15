'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { BANNER_BUCKET, validateBanner } from '@/services/banners';
import type { Banner } from '@/types/database';

export type BannerResult = { error?: string; message?: string; draft?: Banner };
const validId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const conflict = 'A campanha foi alterada em outra sessão. Recarregue antes de editar.';

export async function saveBanner(form: FormData): Promise<BannerResult> {
  try {
    const { supabase } = await requireAdmin();
    const id = String(form.get('id') ?? '');
    const revision = Number(form.get('revision'));
    if (!Number.isSafeInteger(revision) || revision < 0 || (revision === 0 ? !!id : !validId(id)))
      return { error: 'Recarregue a página para continuar.' };
    const value = {
      title: String(form.get('title') ?? '').trim(),
      subtitle: String(form.get('subtitle') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      link: String(form.get('link') ?? '').trim(),
      desktop_path: String(form.get('desktop_path') ?? ''),
      mobile_path: String(form.get('mobile_path') ?? ''),
      layout: String(form.get('layout') ?? 'split') as Banner['layout'],
      starts_at: String(form.get('starts_at') ?? '') || null,
      ends_at: String(form.get('ends_at') ?? '') || null,
      position: Number(form.get('position') ?? 0),
      desktop_position_y: Number(form.get('desktop_position_y') ?? 0),
    };
    const invalid = validateBanner(value);
    if (invalid) return { error: invalid };
    for (const path of new Set([value.desktop_path, value.mobile_path])) {
      const { error } = await supabase.storage.from(BANNER_BUCKET).info(path);
      if (error) return { error: 'Uma imagem não está disponível. Envie-a novamente.' };
    }
    const query =
      revision === 0
        ? supabase.from('banner_campaigns').insert({ ...value, slot: 'home' })
        : supabase.from('banner_campaigns').update(value).eq('id', id).eq('revision', revision);
    const { data, error } = await query.select('*').maybeSingle();
    if (error?.code === '23505' || (!error && !data)) return { error: conflict };
    if (error || !data) return { error: 'Não foi possível salvar o rascunho.' };
    revalidatePath('/admin/banners');
    return { message: 'Rascunho salvo. Publique para exibi-lo na home.', draft: data };
  } catch {
    return { error: 'Não foi possível salvar. Verifique sua conexão e seu acesso administrativo.' };
  }
}
async function changeBanner(
  id: string,
  revision: number,
  operation: 'publish' | 'unpublish' | 'delete',
): Promise<BannerResult> {
  try {
    const { supabase } = await requireAdmin();
    if (!validId(id) || !Number.isSafeInteger(revision) || revision < 1)
      return { error: 'Salve o rascunho antes de continuar.' };
    const { data, error } = await supabase
      .rpc('change_banner_campaign', {
        input_id: id,
        expected_revision: revision,
        operation,
      })
      .single();
    if (error?.code === '40001') return { error: conflict };
    if (error?.message?.includes('Campaign has ended'))
      return { error: 'Esta campanha já terminou. Atualize o período e salve antes de publicar.' };
    if (error || !data)
      return {
        error: 'Não foi possível alterar a campanha. Confira as imagens e tente novamente.',
      };
    updateTag('home-banner');
    revalidatePath('/');
    revalidatePath('/admin/banners');
    return {
      draft: data,
      message:
        operation === 'publish'
          ? 'Campanha publicada conforme o período definido.'
          : operation === 'delete'
            ? 'Card excluído.'
            : 'Campanha retirada do ar. O card continua salvo.',
    };
  } catch {
    return { error: 'Não foi possível alterar a campanha. Verifique seu acesso administrativo.' };
  }
}
export async function publishBanner(id: string, revision: number) {
  return changeBanner(id, revision, 'publish');
}
export async function unpublishBanner(id: string, revision: number) {
  return changeBanner(id, revision, 'unpublish');
}
export async function deleteBanner(id: string, revision: number) {
  return changeBanner(id, revision, 'delete');
}
