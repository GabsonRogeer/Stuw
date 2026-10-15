import Link from 'next/link';
import { Search, SlidersHorizontal } from 'lucide-react';
import { ORDER_LABELS } from '@/services/orders';

export function OrderListFilters({
  basePath,
  q,
  status,
  mode,
}: {
  basePath: string;
  q: string;
  status: string;
  mode: string;
}) {
  return (
    <form
      action={basePath}
      className="order-list-filters grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_1fr_1fr]"
    >
      <label className="text-xs">
        Buscar por número, nome ou e-mail
        <div className="relative mt-2">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stuw-slate pointer-events-none"
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder="Ex.: STUW-1NJCHS ou nome do cliente"
            className="field !mt-0 !pl-10"
          />
        </div>
      </label>
      <label className="text-xs">
        Status do pedido
        <select name="status" defaultValue={status} className="field mt-2">
          <option value="">Todos os status</option>
          {Object.entries(ORDER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Tipo de pedido
        <select name="mode" defaultValue={mode} className="field mt-2">
          <option value="">Todos os tipos</option>
          <option value="live">Real</option>
          <option value="sandbox">Sandbox Mercado Pago</option>
          <option value="demo">Teste demonstrativo</option>
        </select>
      </label>
      <div className="flex items-center gap-4 sm:col-span-2 xl:col-span-3">
        <button className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-stuw-sage text-white">
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filtrar pedidos
        </button>
        {(q || status || mode) && (
          <Link className="text-xs underline underline-offset-4" href={basePath}>
            Limpar filtros
          </Link>
        )}
      </div>
    </form>
  );
}
