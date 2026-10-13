import { requireAdminPage } from '@/lib/supabase/admin-page';
import { BannerManager } from '@/components/admin/BannerManager';
import type { Banner } from '@/types/database';

export default async function BannersPage() {
  const { supabase } = await requireAdminPage();
  async function list(table: 'banner_campaigns' | 'banner_publications') {
    const rows: Banner[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .is('deleted_at', null)
        .order('position')
        .order('created_at')
        .order('id')
        .range(offset, offset + 999);
      if (error) return { rows: [], error };
      rows.push(...data);
      if (data.length < 1000) return { rows, error: null };
    }
  }
  const [drafts, publications] = await Promise.all([
    list('banner_campaigns'),
    list('banner_publications'),
  ]);
  // Server request timestamp keeps the initial campaign status identical during hydration.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <>
      <h2 className="font-serif text-3xl border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        Campanhas da home
      </h2>
      <p className="text-sm text-stuw-slate my-6">
        Crie e guarde seus cards. As campanhas publicadas e dentro do período alternam no carrossel.
      </p>
      {drafts.error || publications.error ? (
        <p role="alert">Não foi possível carregar as campanhas. Tente novamente.</p>
      ) : (
        <BannerManager drafts={drafts.rows} publications={publications.rows} now={now} />
      )}
    </>
  );
}
