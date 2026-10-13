import Link from 'next/link';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { CategoryEditor } from '@/components/admin/CategoryEditor';
import { CATEGORY_KINDS } from '@/services/categories';

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; tipo?: string; status?: string; depois?: string }>;
}) {
  const { supabase } = await requireAdminPage();
  const params = await searchParams;
  const search = (typeof params.busca === 'string' ? params.busca : '').trim().slice(0, 80);
  const kind = params.tipo === 'piece' || params.tipo === 'activity' ? params.tipo : '';
  const status =
    params.status === 'arquivadas' || params.status === 'todas' ? params.status : 'ativas';
  const cursor = Number(params.depois);
  const after = Number.isSafeInteger(cursor) && cursor > 0 ? cursor : 0;
  let query = supabase.from('product_categories').select('*').order('id').gt('id', after).limit(21);
  if (kind) query = query.eq('kind', kind);
  if (status !== 'todas') query = query.eq('archived', status === 'arquivadas');
  if (search) query = query.ilike('label', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
  const { data, error } = await query;
  const rows = data?.slice(0, 20) ?? [];
  const link = (next: number) =>
    `/admin/categorias?${new URLSearchParams({ busca: search, tipo: kind, status, depois: String(next) })}`;
  return (
    <>
      <div className="border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        <p className="eyebrow mb-2">Catálogo STUW</p>
        <h2 className="font-serif text-3xl">Categorias</h2>
      </div>
      <p className="text-sm text-stuw-slate my-6">
        Organize os tipos de peça e as linhas de uso da loja. A ordem define a posição nos menus e
        filtros: números menores aparecem primeiro.
      </p>
      {error ? (
        <p role="alert" className="border border-amber-300 rounded p-4 text-sm">
          Não foi possível carregar as categorias. Verifique a conexão e se a migração de categorias
          foi aplicada.
        </p>
      ) : (
        <>
          <section
            aria-labelledby="new-category"
            className="border border-stuw-border dark:border-stuw-borderDark rounded-lg p-5 mb-8"
          >
            <h3 id="new-category" className="font-medium mb-4">
              Nova categoria
            </h3>
            <CategoryEditor />
          </section>
          <form className="flex flex-wrap gap-3 mb-5">
            <input
              name="busca"
              defaultValue={search}
              maxLength={80}
              placeholder="Buscar categoria"
              aria-label="Buscar categoria por nome"
              className="border border-stuw-border dark:border-stuw-borderDark rounded p-3 bg-transparent text-sm flex-1 min-w-48"
            />
            <select
              name="tipo"
              defaultValue={kind}
              aria-label="Tipo de categoria"
              className="filter-select !mt-0 !w-auto"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(CATEGORY_KINDS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={status}
              aria-label="Status da categoria"
              className="filter-select !mt-0 !w-auto"
            >
              <option value="ativas">Ativas</option>
              <option value="arquivadas">Arquivadas</option>
              <option value="todas">Todas</option>
            </select>
            <button className="border border-stuw-border dark:border-stuw-borderDark rounded px-5 py-3 text-sm">
              Filtrar
            </button>
          </form>
          <div className="space-y-3">
            {rows.map((category) => (
              <div
                key={`${category.id}:${category.revision}`}
                className="border border-stuw-border dark:border-stuw-borderDark rounded-lg p-5"
              >
                <CategoryEditor category={category} />
              </div>
            ))}
          </div>
          {!rows.length && (
            <p className="py-10 text-center text-sm text-stuw-slate">
              Nenhuma categoria encontrada.
            </p>
          )}
          <nav
            aria-label="Páginas de categorias"
            className="flex justify-between gap-3 mt-6 text-sm"
          >
            {after > 0 ? (
              <Link href={link(0)} className="border rounded px-4 py-2">
                Voltar ao início
              </Link>
            ) : (
              <span />
            )}
            {(data?.length ?? 0) > 20 && (
              <Link href={link(rows[rows.length - 1].id)} className="border rounded px-4 py-2">
                Próximas categorias
              </Link>
            )}
          </nav>
          <p className="text-xs text-stuw-slate mt-6">
            Remover arquiva a categoria sem excluir produtos. Use o filtro “Arquivadas” para
            restaurá-la.
          </p>
        </>
      )}
    </>
  );
}
