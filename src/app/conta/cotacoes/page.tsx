import Link from 'next/link';
import { requireAccount } from '@/lib/supabase/account';
import { QUOTE_LABELS } from '@/services/wholesale';
export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { supabase, user } = await requireAccount();
  const page = Math.min(10000, Math.max(1, Math.floor(Number((await searchParams).page) || 1)));
  const { data, error, count } = await supabase
    .from('wholesale_quotes')
    .select('id,number,status,quantity,created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 20, page * 20 - 1);
  return (
    <>
      <h2 className="font-serif text-3xl mb-6">Minhas cotações</h2>
      {error ? (
        <p role="alert">Não foi possível carregar as cotações. Tente novamente.</p>
      ) : (
        <>
          <p className="text-sm text-stuw-slate mb-5">{count ?? 0} solicitação(ões) de atacado.</p>
          <ul className="space-y-4">
            {data?.map((q) => (
              <li key={q.id}>
                <Link
                  className="block border rounded-lg p-5 border-stuw-border dark:border-stuw-borderDark"
                  href={`/conta/cotacoes/${q.id}`}
                >
                  <p className="text-sm break-all">{q.number}</p>
                  <p className="text-sm mt-2">
                    {QUOTE_LABELS[q.status]} · {q.quantity} peças
                  </p>
                  <p className="text-xs text-stuw-slate mt-2">
                    {new Date(q.created_at).toLocaleDateString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                    })}{' '}
                    · Ver detalhes
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <nav className="flex justify-between text-sm my-6" aria-label="Páginas de cotações">
            {page > 1 ? <Link href={`?page=${page - 1}`}>Anterior</Link> : <span />}
            {page * 20 < (count ?? 0) && <Link href={`?page=${page + 1}`}>Próxima</Link>}
          </nav>
        </>
      )}
      <Link href="/atacado" className="underline text-sm">
        Explorar atacado
      </Link>
    </>
  );
}
