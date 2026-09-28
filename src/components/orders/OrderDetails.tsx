import type { Order, OrderEvent } from '@/types/database';
import { currency } from '@/lib/commerce';
import { ORDER_LABELS } from '@/services/orders';
export function OrderDetails({ order, events }: { order: Order; events: OrderEvent[] }) {
  const address = order.delivery;
  return (
    <div className="space-y-7">
      <header className="border-b pb-5 border-stuw-border dark:border-stuw-borderDark">
        <h2 className="font-serif text-2xl break-all">Pedido {order.number}</h2>
        <p className="text-sm mt-3">
          {ORDER_LABELS[order.status]} ·{' '}
          {new Date(order.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        </p>
        {order.is_demo && (
          <p className="text-sm mt-3 text-stuw-sage dark:text-stuw-champagne">
            Pedido de teste — sem cobrança ou envio de mercadoria.
          </p>
        )}
      </header>
      <section>
        <h3 className="font-serif text-xl mb-4">Itens do pedido</h3>
        {!order.items.length && (
          <p className="text-sm text-stuw-slate">Itens não disponíveis neste registro anterior.</p>
        )}
        <ul className="divide-y divide-stuw-border dark:divide-stuw-borderDark">
          {order.items.map((item, index) => (
            <li key={index} className="py-4 flex justify-between gap-4 text-sm">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-stuw-slate text-xs mt-1">
                  {item.color} · {item.size} · Quantidade: {item.qty}
                </p>
                <p className="text-xs mt-1">{currency(item.price_cents / 100)} por unidade</p>
              </div>
              <p className="whitespace-nowrap">{currency((item.price_cents * item.qty) / 100)}</p>
            </li>
          ))}
        </ul>
      </section>
      <div className="grid sm:grid-cols-2 gap-6 text-sm">
        <section>
          <h3 className="font-serif text-xl mb-3">Cliente e entrega</h3>
          <p>{order.customer_name || 'Cliente cadastrado'}</p>
          <p className="break-all">{order.customer_email}</p>
          {address.street && (
            <address className="not-italic mt-3 space-y-1">
              <p>
                {address.street}, {address.number}
              </p>
              <p>{address.complement}</p>
              <p>
                {address.district} · {address.city}/{address.state}
              </p>
              <p>CEP {address.postalCode}</p>
              <p>{address.phone}</p>
            </address>
          )}
          <p className="mt-3">
            {order.shipping_name} {order.shipping_estimate && `· ${order.shipping_estimate}`}
          </p>
          {order.tracking_code && (
            <p className="mt-3 break-all">
              Rastreio: {order.carrier} · {order.tracking_code}
            </p>
          )}
        </section>
        <section>
          <h3 className="font-serif text-xl mb-3">Resumo</h3>
          <dl className="space-y-2">
            {(
              [
                ['Produtos', order.subtotal_cents],
                ['Frete', order.shipping_cents],
                ['Embalagem de presente', order.gift_cents],
                ['Cupom ' + order.coupon_code, -order.discount_cents],
                ['Desconto PIX', -order.pix_discount_cents],
                ['Total', order.total_cents],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt>{label}</dt>
                <dd>{currency(value / 100)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4">
            {order.payment_method === 'pix'
              ? 'PIX'
              : order.payment_method === 'card'
                ? `Cartão · ${order.installments}x`
                : 'Pagamento não informado'}
          </p>
          {order.gift && <p className="mt-2">Este pedido é um presente.</p>}
        </section>
      </div>
      <section>
        <h3 className="font-serif text-xl mb-4">Histórico</h3>
        <ol className="border-l border-stuw-border dark:border-stuw-borderDark pl-5 space-y-4">
          {events.map((event) => (
            <li key={event.id} className="text-sm">
              <p>
                {ORDER_LABELS[event.status]} · {event.note}
              </p>
              <time className="text-xs text-stuw-slate">
                {new Date(event.created_at).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                })}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
