'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';
import type { CardPaymentData } from '@/services/fulfillment';

type Controller = { unmount(): void };
type MercadoPagoConstructor = new (
  key: string,
  options: { locale: string },
) => {
  bricks(): { create(type: string, id: string, settings: unknown): Promise<Controller> };
};
declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}
export function MercadoPagoCard({
  amount,
  email,
  document,
  onSubmit,
}: {
  amount: number;
  email: string;
  document: string;
  onSubmit: (data: CardPaymentData) => Promise<void>;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const submit = useRef(onSubmit);
  useEffect(() => {
    submit.current = onSubmit;
  }, [onSubmit]);
  useEffect(() => {
    if (!ready || !window.MercadoPago || !process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY) return;
    let disposed = false;
    let controller: Controller | undefined;
    const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY, {
      locale: 'pt-BR',
    });
    void mp
      .bricks()
      .create('cardPayment', id, {
        initialization: {
          amount,
          payer: {
            email,
            identification: { type: document.length === 11 ? 'CPF' : 'CNPJ', number: document },
          },
        },
        customization: {
          paymentMethods: { maxInstallments: 6, types: { included: ['credit_card'] } },
          visual: { style: { theme: 'flat' } },
        },
        callbacks: {
          onReady: () => {
            if (!disposed) setError('');
          },
          onError: () => {
            if (!disposed)
              setError('Não foi possível carregar o cartão. Atualize a página ou escolha Pix.');
          },
          onSubmit: (data: CardPaymentData) => submit.current(data),
        },
      })
      .then((value) => {
        if (disposed) value.unmount();
        else controller = value;
      })
      .catch(() => {
        if (!disposed) setError('Não foi possível carregar o formulário de cartão.');
      });
    return () => {
      disposed = true;
      controller?.unmount();
    };
  }, [ready, id, amount, email, document]);
  if (!process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY)
    return (
      <p role="alert" className="text-sm">
        Pagamento por cartão temporariamente indisponível.
      </p>
    );
  return (
    <div>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        onReady={() => setReady(true)}
        onError={() => setError('Não foi possível carregar o Mercado Pago.')}
      />
      {!ready && !error && (
        <p role="status" className="text-sm">
          Carregando pagamento seguro…
        </p>
      )}
      <div id={id} />
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
