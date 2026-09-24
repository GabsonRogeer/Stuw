import Link from 'next/link';
import { categories, activityCategories, fabrics, occasions } from '@/data/navigation';
import type { CatalogQuery } from '@/services/catalog';
import type { Product } from '@/types';

export function CatalogFilters({ query, products }: { query: CatalogQuery; products: Product[] }) {
  const collections = [...new Set(products.map((product) => product.collection))].sort();
  const colors = [
    ...new Set(products.flatMap((product) => product.colors.map((color) => color.name))),
  ].sort();
  return (
    <form
      action="/produtos"
      className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 py-6 border-y border-stuw-border dark:border-stuw-borderDark mb-8"
    >
      <label className="text-[10px] uppercase tracking-wider">
        Categoria
        <select name="categoria" defaultValue={query.categoria ?? ''} className="filter-select">
          <option value="">Todas</option>
          <optgroup label="Por peça">
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Por atividade">
            {activityCategories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className="text-[10px] uppercase tracking-wider">
        Coleção
        <select name="colecao" defaultValue={query.colecao ?? ''} className="filter-select">
          <option value="">Todas</option>
          {collections.map((collection) => (
            <option key={collection}>{collection}</option>
          ))}
        </select>
      </label>
      <label className="text-[10px] uppercase tracking-wider">
        Cor
        <select name="cor" defaultValue={query.cor ?? ''} className="filter-select">
          <option value="">Todas</option>
          {colors.map((color) => (
            <option key={color}>{color}</option>
          ))}
        </select>
      </label>
      <label className="text-[10px] uppercase tracking-wider">
        Tecido
        <select name="tecido" defaultValue={query.tecido ?? ''} className="filter-select">
          <option value="">Todos</option>
          {fabrics.map((fabric) => (
            <option key={fabric}>{fabric}</option>
          ))}
        </select>
      </label>
      <label className="text-[10px] uppercase tracking-wider">
        Ocasião
        <select name="ocasiao" defaultValue={query.ocasiao ?? ''} className="filter-select">
          <option value="">Todas</option>
          {occasions.map((occasion) => (
            <option key={occasion}>{occasion}</option>
          ))}
        </select>
      </label>
      <label className="text-[10px] uppercase tracking-wider">
        Ordenar
        <select name="ordem" defaultValue={query.ordem ?? ''} className="filter-select">
          <option value="">Seleção STUW</option>
          <option value="menor-preco">Menor preço</option>
          <option value="maior-preco">Maior preço</option>
        </select>
      </label>
      <label className="text-[10px] uppercase tracking-wider">
        Buscar
        <input
          type="search"
          name="busca"
          defaultValue={query.busca ?? ''}
          placeholder="Produto, cor ou coleção"
          className="filter-select"
        />
      </label>
      <div className="flex items-end justify-end gap-4 text-xs">
        <Link href="/produtos" className="underline py-2">
          Limpar
        </Link>
        <button
          type="submit"
          className="px-4 py-2 bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian"
        >
          Filtrar
        </button>
      </div>
    </form>
  );
}
