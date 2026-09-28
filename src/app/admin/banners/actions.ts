'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { BANNER_BUCKET, validateBanner } from '@/services/banners';
import type { Banner } from '@/types/database';
export type BannerResult = { error?: string; message?: string; draft?: Banner };
export async function saveBanner(form: FormData): Promise<BannerResult> {
  try {
    const { supabase } = await requireAdmin();
    const value = {
      title: String(form.get('title') ?? '').trim(),
      subtitle: String(form.get('subtitle') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      link: String(form.get('link') ?? '').trim(),
      desktop_path: String(form.get('desktop_path') ?? ''),
      mobile_path: String(form.get('mobile_path') ?? ''),
    };
    const invalid = validateBanner(value);
    if (invalid) return { error: invalid };
    for (const path of [value.desktop_path, value.mobile_path]) {
      const { error } = await supabase.storage.from(BANNER_BUCKET).info(path);
      if (error)
        return { error: 'Uma imagem não está disponível no armazenamento. Envie-a novamente.' };
    }
    const revision = Number(form.get('revision'));
    if (!Number.isSafeInteger(revision) || revision < 0)
      return { error: 'Recarregue a página para continuar.' };
    const query =
      revision === 0
        ? supabase.from('banner_drafts').insert({ ...value, slot: 'home' })
        : supabase.from('banner_drafts').update(value).eq('slot', 'home').eq('revision', revision);
    const { data, error } = await query.select('*').maybeSingle();
    if (error?.code === '23505' || (!error && !data))
      return {
        error: 'O rascunho foi alterado em outra sessão. Recarregue a página antes de editar.',
      };
    if (error || !data) return { error: 'Não foi possível salvar o rascunho. Tente novamente.' };
    revalidatePath('/admin/banners');
    return { message: 'Rascunho salvo. A home permanece com a versão publicada.', draft: data };
  } catch {
    return { error: 'Não foi possível salvar. Verifique sua conexão e seu acesso administrativo.' };
  }
}
export async function publishBanner(revision: number): Promise<BannerResult> {
  try {
    const { supabase } = await requireAdmin();
    if (!Number.isSafeInteger(revision) || revision < 1)
      return { error: 'Salve o rascunho antes de publicar.' };
    const { error } = await supabase.rpc('publish_home_banner', { expected_revision: revision });
    if (error)
      return {
        error: 'Não foi possível publicar. Recarregue a página e confira o rascunho e as imagens.',
      };
    updateTag('home-banner');
    revalidatePath('/');
    revalidatePath('/admin/banners');
    return { message: 'Banner publicado na home.' };
  } catch {
    return { error: 'Não foi possível publicar. Verifique seu acesso administrativo.' };
  }
}
export async function unpublishBanner(): Promise<BannerResult> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc('unpublish_home_banner');
    if (error) return { error: 'Não foi possível retirar o banner do ar.' };
    updateTag('home-banner');
    revalidatePath('/');
    revalidatePath('/admin/banners');
    return { message: 'Banner retirado do ar. A home voltou ao destaque original.' };
  } catch {
    return { error: 'Não foi possível retirar o banner do ar.' };
  }
}
