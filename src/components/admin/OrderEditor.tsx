'use client';
import { useActionState } from 'react';
import { updateOrder } from '@/app/admin/pedidos/actions';
import { ORDER_LABELS, ORDER_TRANSITIONS } from '@/services/orders';
import type { Order } from '@/types/database';
export function OrderEditor({ order }: { order: Order }) {
  const [state, action, pending] = useActionState(updateOrder, {});
  if (!ORDER_TRANSITIONS[order.status]?.length)
    return <p className="text-sm text-stuw-slate">Pedido encerrado.</p>;
  const statuses = [order.status, ...ORDER_TRANSITIONS[order.status]].filter(
    (s) => order.is_demo || s !== 'paid' || order.status === 'paid',
  );
  return (
    <form
      action={action}
      className="space-y-4 border rounded-lg p-5 border-stuw-border dark:border-stuw-borderDark"
    >
      <h3 className="font-serif text-xl">Gerenciar pedido</h3>
      {order.is_demo && (
        <p className="text-xs text-stuw-slate">
          As alterações de pagamento e entrega deste pedido são simulações.
        </p>
      )}
      <input type="hidden" name="id" value={order.id} />
      <input type="hidden" name="revision" value={order.revision} />
      <label className="block text-sm">
        Status
        <select name="status" className="field mt-2" defaultValue={order.status}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {ORDER_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block text-sm">
          Transportadora
          <input
            name="carrier"
            className="field mt-2"
            maxLength={100}
            defaultValue={order.carrier}
          />
        </label>
        <label className="block text-sm">
          Código de rastreio
          <input
            name="tracking"
            className="field mt-2"
            maxLength={100}
            defaultValue={order.tracking_code}
          />
        </label>
      </div>
      <p className="text-xs text-stuw-slate">
        Cancelar encerra o pedido. Esta ação não realiza estornos nem devolve utilizações de cupom.
      </p>
      <button
        disabled={pending}
        className="px-5 py-3 rounded-md bg-stuw-obsidian text-white dark:bg-stuw-canvas dark:text-stuw-obsidian text-sm disabled:opacity-50"
      >
        {pending ? 'Salvando…' : 'Salvar alterações'}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
