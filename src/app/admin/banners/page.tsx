import { requireAdminPage } from '@/lib/supabase/admin-page';
import { BannerEditor } from '@/components/admin/BannerEditor';
export default async function BannersPage() {
  const { supabase } = await requireAdminPage();
  const [draft, published] = await Promise.all([
    supabase.from('banner_drafts').select('*').eq('slot', 'home').maybeSingle(),
    supabase.from('site_banners').select('*').eq('slot', 'home').maybeSingle(),
  ]);
  return (
    <>
      <h2 className="font-serif text-3xl border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        Banner principal da home
      </h2>
      <p className="text-sm text-stuw-slate my-6">
        Prepare as imagens e o conteúdo, confira a prévia e publique quando estiver pronto.
      </p>
      {draft.error || published.error ? (
        <p role="alert">
          Não foi possível carregar os banners. Verifique a migração e tente novamente.
        </p>
      ) : (
        <BannerEditor draft={draft.data} published={published.data} />
      )}
    </>
  );
}
