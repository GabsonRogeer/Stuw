import { calculateTotals, currency } from '@/lib/commerce';

export function OrderSummary({ totals }: { totals: ReturnType<typeof calculateTotals> }) {
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd>{currency(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between text-stuw-sage dark:text-stuw-champagne">
          <dt>Cupom PRIVE10</dt>
          <dd>− {currency(totals.discount)}</dd>
        </div>
      )}
      {totals.pixDiscount > 0 && (
        <div className="flex justify-between text-stuw-sage dark:text-stuw-champagne">
          <dt>PIX · 5%</dt>
          <dd>− {currency(totals.pixDiscount)}</dd>
        </div>
      )}
      <div className="flex justify-between">
        <dt>Frete estimado</dt>
        <dd>{totals.shipping ? currency(totals.shipping) : 'Cortesia'}</dd>
      </div>
      {totals.giftCost > 0 && (
        <div className="flex justify-between">
          <dt>Embalagem presente</dt>
          <dd>{currency(totals.giftCost)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-stuw-border dark:border-stuw-borderDark pt-4 font-semibold text-base">
        <dt>Total</dt>
        <dd>{currency(totals.total)}</dd>
      </div>
    </dl>
  );
}
