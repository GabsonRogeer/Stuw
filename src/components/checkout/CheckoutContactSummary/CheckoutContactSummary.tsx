'use client';

import Link from 'next/link';
import { useCheckout } from '@/providers/checkout-provider';
import { currency } from '@/lib/commerce';

export function CheckoutContactSummary({ showShipping = false }: { showShipping?: boolean }) {
  const { information: info, shipping } = useCheckout();
  return (
    <dl className="mb-8 border-y border-stuw-border dark:border-stuw-borderDark divide-y divide-stuw-border dark:divide-stuw-borderDark text-xs">
      <div className="flex gap-4 py-4">
        <dt className="w-20 shrink-0 text-stuw-slate">Contato</dt>
        <dd className="flex-1 break-all">{info.email}</dd>
        <dd>
          <Link href="/checkout/information" className="underline" aria-label="Alterar contato">
            Alterar
          </Link>
        </dd>
      </div>
      <div className="flex gap-4 py-4">
        <dt className="w-20 shrink-0 text-stuw-slate">Enviar para</dt>
        <dd className="flex-1 leading-relaxed">
          {info.firstName} {info.lastName}
          <br />
          {info.street}, {info.number}
          {info.complement ? `, ${info.complement}` : ''}
          <br />
          {info.district} · {info.postalCode}
          <br />
          {info.city} / {info.state}, Brasil
        </dd>
        <dd>
          <Link
            href="/checkout/information"
            className="underline"
            aria-label="Alterar endereço de entrega"
          >
            Alterar
          </Link>
        </dd>
      </div>
      {showShipping && shipping && (
        <div className="flex gap-4 py-4">
          <dt className="w-20 shrink-0 text-stuw-slate">Frete</dt>
          <dd className="flex-1">
            {shipping.name} · {shipping.price ? currency(shipping.price) : 'Cortesia'}
            <br />
            <span className="text-stuw-slate">{shipping.deliveryEstimate}</span>
          </dd>
          <dd>
            <Link href="/checkout/shipping" className="underline" aria-label="Alterar frete">
              Alterar
            </Link>
          </dd>
        </div>
      )}
    </dl>
  );
}
