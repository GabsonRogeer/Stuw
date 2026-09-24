'use client';

import Image from 'next/image';
import { useCheckout } from '@/providers/checkout-provider';
import { currency, itemKey } from '@/lib/commerce';
import { OrderSummary } from '@/components/cart/OrderSummary/OrderSummary';
import { CouponForm } from '@/components/cart/CouponForm/CouponForm';

export function CheckoutSummary() {
  const { items, totals, shipping } = useCheckout();
  return (
    <aside
      aria-label="Resumo do pedido"
      className="lg:sticky lg:top-8 self-start bg-stuw-sand/40 dark:bg-stone-900 rounded-2xl border border-stuw-border dark:border-stuw-borderDark p-5 sm:p-8"
    >
      <h2 className="font-serif text-2xl mb-6">Seu pedido</h2>
      <ul className="space-y-5 mb-7">
        {items.map((item) => (
          <li key={itemKey(item)} className="flex gap-4 items-center">
            <div className="relative shrink-0">
              <Image
                src={item.image}
                alt={item.title}
                width={64}
                height={85}
                className="w-16 h-[85px] object-cover rounded-lg"
              />
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian text-[10px]">
                {item.qty}
              </span>
            </div>
            <div className="flex-1 text-xs min-w-0">
              <p className="leading-relaxed">{item.title}</p>
              <p className="text-stuw-slate mt-1">
                {item.color} / {item.size}
              </p>
            </div>
            <span className="text-xs whitespace-nowrap">{currency(item.price * item.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="mb-7">
        <CouponForm />
      </div>
      <OrderSummary
        totals={totals}
        shippingPending={!shipping}
        shippingLabel={shipping ? shipping.name : 'Frete'}
      />
    </aside>
  );
}
