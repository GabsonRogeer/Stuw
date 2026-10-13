'use client';

import Link from 'next/link';
import { useEffect, useEffectEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useCheckout } from '@/providers/checkout-provider';
import { currency } from '@/lib/commerce';
import { CheckoutContactSummary } from '@/components/checkout/CheckoutContactSummary/CheckoutContactSummary';
import { Button } from '@/components/ui/button/button';

export function CheckoutShipping() {
  const {
    shippingOptions,
    shipping,
    selectShipping,
    shippingError,
    shippingLoading,
    loadShipping,
    shippingContext,
  } = useCheckout();
  const calculate = useEffectEvent(() => {
    void loadShipping();
  });
  useEffect(() => {
    calculate();
  }, [shippingContext]);
  const router = useRouter();
  return (
    <div>
      <CheckoutContactSummary />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (shipping) router.push('/checkout/payment');
        }}
      >
        <h1 className="font-serif text-3xl mb-3">Forma de frete</h1>
        <p className="text-xs text-stuw-slate mb-6">
          Valores consultados no Melhor Envio. O prazo de transporte começa após a postagem.
        </p>
        {shippingLoading && (
          <p role="status" className="text-sm mb-5">
            Calculando as opções de entrega…
          </p>
        )}
        {shippingError && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300 mb-4">
            {shippingError}
          </p>
        )}
        <button
          type="button"
          disabled={shippingLoading}
          onClick={() => {
            void loadShipping(true);
          }}
          className="text-xs underline mb-5 disabled:opacity-50"
        >
          Recalcular frete
        </button>
        <fieldset className="space-y-3">
          <legend className="sr-only">Selecione a forma de entrega</legend>
          {shippingOptions.map((option) => (
            <label
              key={option.id}
              className={`flex gap-3 p-5 border rounded-xl cursor-pointer ${shipping?.id === option.id ? 'border-stuw-obsidian dark:border-stuw-canvas bg-stuw-sand/40 dark:bg-stone-900' : 'border-stuw-border dark:border-stuw-borderDark'}`}
            >
              <input
                type="radio"
                required
                name="shipping"
                checked={shipping?.id === option.id}
                onChange={() => selectShipping(option.id)}
                value={option.id}
                className="accent-stuw-sage mt-0.5"
              />
              <span className="flex-1 text-sm">
                <span className="block font-medium">{option.name}</span>
                <span className="block text-xs text-stuw-slate mt-2">
                  {option.deliveryEstimate}
                </span>
              </span>
              <span className="text-sm">{option.price ? currency(option.price) : 'Cortesia'}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-5 mt-9">
          <Link href="/checkout/information" className="inline-flex items-center gap-2 text-xs">
            <ArrowLeft size={14} /> Voltar para as informações
          </Link>
          <Button
            type="submit"
            disabled={!shipping}
            className="rounded-xl w-full sm:w-auto !normal-case !tracking-normal !py-4"
          >
            Continuar para pagamento
          </Button>
        </div>
      </form>
    </div>
  );
}
