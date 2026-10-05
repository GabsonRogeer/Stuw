import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { PRODUCTS } from '@/data/products';
import { currency } from '@/lib/commerce';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string; pagina?: string }>;
}) {
  const { supabase } = await requireAdminPage();
  const q = await searchParams;
  const { data, error } = await supabase
    .from('admin_products')
    .select('*')
    .order('updated_at', { ascending: false });
  const managed = new Set(data?.map((p) => p.id));
  const rows = [
    ...(data ?? [])
      .filter((p) => !p.deleted_at)
      .map((p) => ({
        id: p.id,
        name: p.document.name,
        slug: p.document.slug,
        price: p.document.price,
        colors: p.document.colors.length,
        status: p.document.status,
        legacy: false,
      })),
    ...PRODUCTS.filter((p) => !managed.has(p.id)).map((p) => ({
      id: p.id,
      name: p.title,
      slug: p.slug,
      price: p.price,
      colors: p.colors.length,
      status: 'legacy',
      legacy: true,
    })),
  ].filter(
    (p) =>
      (!q.status || p.status === q.status) &&
      (!q.busca ||
        `${p.name} ${p.slug}`
          .toLocaleLowerCase('pt-BR')
          .includes(q.busca.toLocaleLowerCase('pt-BR'))),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const page = Math.min(pages, Math.max(1, Number(q.pagina) || 1));
  return (
    <>
      <div className="flex flex-wrap gap-4 items-center justify-between border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        <div>
          <p className="eyebrow mb-2">Catálogo STUW</p>
          <h2 className="font-serif text-3xl">Produtos</h2>
        </div>
        <Link
          href="/admin/produtos/novo"
          className="inline-flex items-center gap-2 bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian rounded px-4 py-3 text-sm"
        >
          <Plus size={17} />
          Novo produto
        </Link>
      </div>
      <p className="text-sm text-stuw-slate my-6">
        Cadastre um modelo e organize suas cores, imagens e SKUs. Os produtos atuais podem ser
        preparados para edição sem alterar sua publicação.
      </p>
      {error ? (
        <p role="alert" className="border border-amber-300 rounded p-4 text-sm">
          O banco do catálogo ainda não está disponível. Aplique a migração de produtos e atualize
          esta página. Os produtos atuais continuam disponíveis na loja.
        </p>
      ) : (
        <>
          <form className="flex flex-wrap gap-3 mb-6">
            <input
              name="busca"
              defaultValue={q.busca}
              placeholder="Buscar por nome ou slug"
              aria-label="Buscar produtos"
              className="border border-stuw-border dark:border-stuw-borderDark rounded p-3 bg-transparent text-sm flex-1 min-w-48"
            />
            <select
              name="status"
              aria-label="Filtrar por status"
              defaultValue={q.status ?? ''}
              className="border border-stuw-border dark:border-stuw-borderDark rounded p-3 bg-stuw-canvas dark:bg-stuw-obsidian text-sm"
            >
              <option value="">Todos os status</option>
              <option value="draft">Rascunhos</option>
              <option value="active">Ativos / agendados</option>
              <option value="inactive">Inativos</option>
              <option value="legacy">Catálogo atual</option>
            </select>
            <button className="border border-stuw-border dark:border-stuw-borderDark rounded px-5 text-sm">
              Filtrar
            </button>
          </form>
          <p className="text-xs text-stuw-slate mb-4">{rows.length} produto(s)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stuw-border dark:border-stuw-borderDark">
                  {['Modelo', 'Cores', 'Preço base', 'Status', ''].map((h, i) => (
                    <th className="py-3 pr-5 font-medium" key={i}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * 20, page * 20).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-stuw-border dark:border-stuw-borderDark"
                  >
                    <td className="py-5 pr-4">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-stuw-slate mt-1">/produtos/{p.slug}</p>
                    </td>
                    <td>{p.colors}</td>
                    <td className="whitespace-nowrap pr-4">
                      {p.price === null ? 'A definir' : currency(p.price)}
                    </td>
                    <td className="text-xs">
                      {
                        {
                          draft: 'Rascunho',
                          active: 'Ativo / agendado',
                          inactive: 'Inativo',
                          legacy: 'Catálogo atual',
                        }[p.status]
                      }
                    </td>
                    <td>
                      <Link
                        href={`/admin/produtos/${p.id}`}
                        aria-label={`Editar ${p.name}`}
                        className="inline-flex gap-2 items-center p-3"
                      >
                        <Pencil size={15} />
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p className="py-10 text-center text-sm text-stuw-slate">Nenhum produto encontrado.</p>
          )}
          {pages > 1 && (
            <nav aria-label="Páginas de produtos" className="flex gap-3 mt-6">
              {Array.from({ length: pages }, (_, i) => (
                <Link
                  key={i}
                  aria-current={page === i + 1 ? 'page' : undefined}
                  className="border rounded px-3 py-2 text-sm"
                  href={`?${new URLSearchParams({ busca: q.busca ?? '', status: q.status ?? '', pagina: String(i + 1) })}`}
                >
                  {i + 1}
                </Link>
              ))}
            </nav>
          )}
        </>
      )}
    </>
  );
}
