'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CreditCard, Gift, QrCode } from 'lucide-react';
import { useCheckout } from '@/providers/checkout-provider';
import { isTaxDocumentValid } from '@/services/checkout';
import { currency } from '@/lib/commerce';
import { CheckoutContactSummary } from '@/components/checkout/CheckoutContactSummary/CheckoutContactSummary';
import { Button } from '@/components/ui/button/button';

export function CheckoutPayment() {
  const [validating, setValidating] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const {
    gift,
    setGift,
    giftWrap,
    setGiftWrap,
    taxDocument,
    setTaxDocument,
    payment,
    setPayment,
    installments,
    setInstallments,
    totals,
    completeDemo,
  } = useCheckout();
  const [documentError, setDocumentError] = useState('');
  const [error, setError] = useState('');
  return (
    <div>
      <CheckoutContactSummary showShipping />
      <h1 className="font-serif text-3xl mb-6">Pagamento</h1>
      <form
        method="post"
        aria-busy={validating}
        inert={validating}
        onSubmit={async (event) => {
          event.preventDefault();
          if (validating) return;
          setError('');
          if (!isTaxDocumentValid(taxDocument)) {
            setDocumentError('Informe um CPF ou CNPJ válido.');
            const input = event.currentTarget.elements.namedItem('taxDocument');
            if (input instanceof HTMLInputElement) input.focus();
            return;
          }
          setValidating(true);
          try {
            const result = await completeDemo();
            setError(result.error ?? '');
            setLoginRequired(Boolean(result.loginRequired));
          } finally {
            setValidating(false);
          }
        }}
        className="space-y-8"
      >
        <section className="border border-stuw-border dark:border-stuw-borderDark rounded-xl p-5 space-y-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={gift}
              onChange={(event) => {
                setGift(event.target.checked);
                if (!event.target.checked) setGiftWrap(false);
              }}
              className="accent-stuw-sage w-4 h-4"
            />
            <Gift size={18} aria-hidden="true" /> Esse pedido é um presente?
          </label>
          {gift && (
            <label className="flex items-start gap-3 text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={giftWrap}
                onChange={(event) => setGiftWrap(event.target.checked)}
                className="accent-stuw-sage mt-0.5"
              />
              Adicionar embalagem para presente · {currency(35)}
            </label>
          )}
        </section>
        <section>
          <h2 className="font-serif text-xl mb-2">CPF/CNPJ obrigatório para emitir nota fiscal</h2>
          <p className="text-xs text-stuw-slate mb-4">Informe o documento do comprador.</p>
          <label htmlFor="checkout-document" className="block text-xs mb-2">
            CPF ou CNPJ
          </label>
          <input
            id="checkout-document"
            name="taxDocument"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={18}
            value={taxDocument}
            onChange={(event) => {
              setTaxDocument(event.target.value.toUpperCase());
              setDocumentError('');
            }}
            aria-invalid={Boolean(documentError)}
            aria-describedby={documentError ? 'document-error' : undefined}
            placeholder="CPF ou CNPJ"
            className="field"
          />
          {documentError && (
            <p
              id="document-error"
              role="alert"
              className="text-xs text-red-700 dark:text-red-300 mt-2"
            >
              {documentError}
            </p>
          )}
        </section>
        <fieldset>
          <legend className="font-serif text-xl mb-4">Forma de pagamento</legend>
          <div className="space-y-3">
            <label
              className={`flex gap-3 items-center border rounded-xl p-5 cursor-pointer ${payment === 'pix' ? 'border-stuw-obsidian dark:border-stuw-canvas' : 'border-stuw-border dark:border-stuw-borderDark'}`}
            >
              <input
                required
                type="radio"
                name="payment"
                value="pix"
                checked={payment === 'pix'}
                onChange={() => setPayment('pix')}
                className="accent-stuw-sage"
              />
              <QrCode size={20} aria-hidden="true" />
              <span className="text-sm">
                PIX <span className="text-stuw-sage dark:text-stuw-champagne">· 5% OFF</span>
              </span>
            </label>
            <label
              className={`flex gap-3 items-center border rounded-xl p-5 cursor-pointer ${payment === 'card' ? 'border-stuw-obsidian dark:border-stuw-canvas' : 'border-stuw-border dark:border-stuw-borderDark'}`}
            >
              <input
                required
                type="radio"
                name="payment"
                value="card"
                checked={payment === 'card'}
                onChange={() => setPayment('card')}
                className="accent-stuw-sage"
              />
              <CreditCard size={20} aria-hidden="true" />
              <span className="text-sm">Cartão de crédito · até 6x sem juros</span>
            </label>
          </div>
          {payment === 'card' && (
            <label className="block text-xs mt-4 space-y-2">
              <span>Parcelamento</span>
              <select
                className="field"
                value={installments}
                onChange={(event) => setInstallments(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>
                    {count}x de {currency(totals.total / count)} sem juros
                  </option>
                ))}
              </select>
            </label>
          )}
          {payment && (
            <p className="text-xs text-stuw-slate mt-4">
              {payment === 'pix'
                ? 'Demonstração: nenhum código PIX será gerado.'
                : 'Demonstração: não solicitamos dados de cartão e nenhuma cobrança será realizada.'}
            </p>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        {loginRequired && (
          <p className="text-sm">
            <Link href="/login?next=checkout" target="_blank" className="underline">
              Entrar na conta em outra aba
            </Link>
            . Depois, retorne e conclua o pedido.
          </p>
        )}
        <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-5">
          <Link href="/checkout/shipping" className="inline-flex items-center gap-2 text-xs">
            <ArrowLeft size={14} /> Voltar para o frete
          </Link>
          <Button
            type="submit"
            disabled={!payment || validating}
            className="rounded-xl w-full sm:w-auto !normal-case !tracking-normal !py-4"
          >
            {validating ? 'Salvando pedido…' : 'Registrar pedido de teste'}
          </Button>
        </div>
        <p className="text-[11px] text-stuw-slate">
          O pedido de teste será salvo em sua conta. Não haverá cobrança, emissão de nota fiscal ou
          envio de mercadoria.
        </p>
      </form>
    </div>
  );
}
