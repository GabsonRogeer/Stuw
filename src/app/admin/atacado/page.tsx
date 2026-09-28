import Link from 'next/link';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { QUOTE_LABELS } from '@/services/wholesale';
import { WholesaleSettingsForm } from '@/components/admin/WholesaleEditor';
export default async function WholesaleAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { supabase } = await requireAdminPage();
  const params = await searchParams;
  const status = Object.hasOwn(QUOTE_LABELS, params.status ?? '') ? params.status! : '';
  const q = (params.q ?? '')
    .replace(/[^\p{L}\p{N}@.\s-]/gu, '')
    .trim()
    .slice(0, 100);
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.page) || 1)));
  let query = supabase
    .from('wholesale_quotes')
    .select('id,number,status,customer_name,company,quantity,created_at', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (q) query = query.or(`number.ilike.%${q}%,customer_name.ilike.%${q}%,company.ilike.%${q}%`);
  const [quotes, settings] = await Promise.all([
    query
      .order('created_at', { ascending: false })
      .order('id')
      .range((page - 1) * 20, page * 20 - 1),
    supabase.from('wholesale_settings').select('*').eq('id', true).single(),
  ]);
  const href = (next: number) =>
    '/admin/atacado?' + new URLSearchParams({ q, status, page: String(next) });
  return (
    <>
      <h2 className="font-serif text-3xl mb-6">Cotações de atacado</h2>
      <details className="border rounded-lg p-5 mb-8 border-stuw-border dark:border-stuw-borderDark">
        <summary className="cursor-pointer font-medium">Configurar mínimo e WhatsApp</summary>
        <div className="mt-5">
          {settings.error || !settings.data ? (
            <p role="alert">Aplique a migração de atacado para configurar o módulo.</p>
          ) : (
            <WholesaleSettingsForm settings={settings.data} />
          )}
        </div>
      </details>
      <form className="grid sm:grid-cols-3 gap-3 mb-6">
        <label className="text-xs">
          Buscar número, cliente ou empresa
          <input className="field mt-2" name="q" defaultValue={q} />
        </label>
        <label className="text-xs">
          Status
          <select className="field mt-2" name="status" defaultValue={status}>
            <option value="">Todos</option>
            {Object.entries(QUOTE_LABELS).map(([s, label]) => (
              <option key={s} value={s}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="border rounded-md self-end py-3 text-sm">Filtrar</button>
      </form>
      {quotes.error ? (
        <p role="alert">
          Não foi possível carregar as cotações. Verifique se a migração foi aplicada.
        </p>
      ) : (
        <>
          <p className="text-xs text-stuw-slate mb-4">{quotes.count ?? 0} cotação(ões)</p>
          <ul className="space-y-4">
            {quotes.data?.map((quote) => (
              <li key={quote.id}>
                <Link
                  className="block border rounded-lg p-5 border-stuw-border dark:border-stuw-borderDark"
                  href={`/admin/atacado/${quote.id}`}
                >
                  <p className="text-sm break-all">{quote.number}</p>
                  <p className="text-sm mt-2">
                    {quote.customer_name}
                    {quote.company && ` · ${quote.company}`}
                  </p>
                  <p className="text-xs text-stuw-slate mt-2">
                    {QUOTE_LABELS[quote.status]} · {quote.quantity} peças ·{' '}
                    {new Date(quote.created_at).toLocaleDateString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <nav className="flex justify-between mt-6 text-sm" aria-label="Páginas de cotações">
            {page > 1 ? <Link href={href(page - 1)}>Anterior</Link> : <span />}
            <span>Página {page}</span>
            {page * 20 < (quotes.count ?? 0) ? (
              <Link href={href(page + 1)}>Próxima</Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </>
  );
}
