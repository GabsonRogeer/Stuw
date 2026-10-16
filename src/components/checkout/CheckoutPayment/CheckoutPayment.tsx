'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCheckout } from '@/providers/checkout-provider';
import { isTaxDocumentValid } from '@/services/checkout';
import type { CardPaymentData } from '@/services/fulfillment';
import { currency } from '@/lib/commerce';
import { CheckoutContactSummary } from '@/components/checkout/CheckoutContactSummary/CheckoutContactSummary';
import { MercadoPagoCard } from '@/components/checkout/MercadoPagoCard';

export function CheckoutPayment() {
  const checkout = useCheckout();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const document = checkout.taxDocument.toUpperCase().replace(/[.\/\-\s]/g, '');
  const validDocument = isTaxDocumentValid(document);
  async function pay(card?: CardPaymentData) {
    if (pending) return;
    if (!validDocument) {
      setError('Informe um CPF ou CNPJ válido.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const result = await checkout.completePayment(card);
      setError(result.error ?? '');
      if (result.error && card) throw new Error(result.error);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-6">
      <CheckoutContactSummary showShipping />
      <h1 className="font-serif text-3xl">Pagamento</h1>
      <fieldset disabled={pending} className="space-y-6 disabled:opacity-60">
        <section className="border border-stuw-border dark:border-stuw-borderDark rounded-xl p-5 space-y-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={checkout.gift}
              onChange={(e) => {
                checkout.setGift(e.target.checked);
                if (!e.target.checked) checkout.setGiftWrap(false);
              }}
            />
            Este pedido é um presente?
          </label>
          {checkout.gift && (
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={checkout.giftWrap}
                onChange={(e) => checkout.setGiftWrap(e.target.checked)}
              />
              Embalagem para presente · {currency(35)}
            </label>
          )}
        </section>
        <label className="block text-sm">
          CPF ou CNPJ do pagador
          <input
            className="field mt-2"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={18}
            value={checkout.taxDocument}
            onChange={(e) => checkout.setTaxDocument(e.target.value.toUpperCase())}
            aria-describedby="payment-document-help"
          />
        </label>
        <p id="payment-document-help" className="text-xs text-stuw-slate">
          Use o mesmo documento no formulário de pagamento.
        </p>
        <fieldset className="space-y-3">
          <legend className="font-serif text-xl mb-4">Forma de pagamento</legend>
          <label className="flex gap-3 border rounded-xl p-5 text-sm">
            <input
              type="radio"
              name="payment"
              checked={checkout.payment === 'pix'}
              onChange={() => checkout.setPayment('pix')}
            />
            {checkout.items.some((item) => item.pixDiscountEligible !== false)
              ? 'Pix · 5% de desconto nos produtos elegíveis'
              : 'Pix'}
          </label>
          <label className="flex gap-3 border rounded-xl p-5 text-sm">
            <input
              type="radio"
              name="payment"
              checked={checkout.payment === 'card'}
              onChange={() => checkout.setPayment('card')}
            />
            Cartão de crédito
          </label>
        </fieldset>
      </fieldset>
      {checkout.payment === 'card' && validDocument && (
        <div aria-busy={pending}>
          <p className="text-xs text-stuw-slate mb-4">
            Preencha seus dados no formulário seguro do Mercado Pago. As parcelas e eventuais juros
            serão exibidos antes da confirmação.
          </p>
          <MercadoPagoCard
            amount={checkout.totals.total}
            email={checkout.information.email}
            document={document}
            onSubmit={pay}
          />
        </div>
      )}
      {checkout.payment === 'card' && !validDocument && (
        <p className="text-sm">Informe um CPF ou CNPJ válido para abrir o formulário de cartão.</p>
      )}
      {checkout.payment === 'pix' && (
        <button
          type="button"
          disabled={pending || !validDocument}
          onClick={() => {
            void pay();
          }}
          className="w-full rounded-xl bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian px-5 py-4 text-sm disabled:opacity-50"
        >
          {pending ? 'Preparando pagamento…' : `Gerar Pix de ${currency(checkout.totals.total)}`}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <p className="text-xs text-stuw-slate">
        O pedido será criado na sua conta e a confirmação ocorrerá após a aprovação do Mercado Pago.
      </p>
      <Link href="/checkout/shipping" className="inline-block underline text-xs">
        Voltar para o frete
      </Link>
    </div>
  );
}
