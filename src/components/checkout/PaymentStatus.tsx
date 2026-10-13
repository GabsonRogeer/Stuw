'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { checkOrderPayment } from '@/app/actions/order';
import { PAYMENT_LABELS, type CheckoutPaymentResult } from '@/services/fulfillment';
import { currency } from '@/lib/commerce';
import { useCart } from '@/providers/cart-provider';

export function PaymentStatus({
  initial,
  clearCart = false,
}: {
  initial: CheckoutPaymentResult;
  clearCart?: boolean;
}) {
  const [order, setOrder] = useState(initial);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { clear } = useCart();
  const cleared = useRef(false);
  const terminal = ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(
    order.paymentStatus,
  );
  useEffect(() => {
    if (clearCart && order.paymentStatus === 'approved' && !cleared.current) {
      cleared.current = true;
      clear();
    }
  }, [clearCart, order.paymentStatus, clear]);
  useEffect(() => {
    if (terminal) return;
    let disposed = false;
    let busy = false;
    const poll = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const result = await checkOrderPayment(initial.id);
        if (disposed) return;
        if (result.order)
          setOrder((prior) => ({
            ...result.order!,
            pix:
              result.order!.paymentStatus === 'pending'
                ? (result.order!.pix ?? prior.pix)
                : undefined,
          }));
        setError(result.error ?? '');
      } catch {
        if (!disposed)
          setError('A confirmação está temporariamente indisponível. Seu pedido foi preservado.');
      } finally {
        busy = false;
      }
    };
    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 20000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [initial.id, terminal]);
  return (
    <section className="max-w-lg mx-auto py-8 space-y-5">
      {order.testMode && (
        <p className="text-sm border rounded p-3">
          Ambiente de teste. Não use dados de cartão real.
        </p>
      )}
      <p className="eyebrow">Pedido {order.code}</p>
      <h1 className="font-serif text-3xl" role="status">
        {order.paymentIssue?.kind === 'request_rejected'
          ? 'Não foi possível iniciar o pagamento'
          : (PAYMENT_LABELS[order.paymentStatus] ?? 'Conferindo pagamento')}
      </h1>
      <p className="text-lg">{currency(order.total)}</p>
      {order.paymentIssue && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {order.paymentIssue.message}
        </p>
      )}
      {order.paymentStatus === 'initializing' && (
        <p className="text-sm">
          Estamos verificando o resultado com o Mercado Pago. Não refaça a compra enquanto a
          confirmação estiver em andamento.
        </p>
      )}
      {order.pix && (
        <div className="space-y-4">
          <p className="text-sm">
            Escaneie o QR Code no aplicativo do seu banco ou copie o código Pix.
          </p>
          <Image
            unoptimized
            src={`data:image/png;base64,${order.pix.image}`}
            alt="QR Code para pagamento Pix"
            width={240}
            height={240}
          />
          <label className="block text-xs">
            Código Pix
            <textarea readOnly value={order.pix.code} className="field mt-2" rows={3} />
          </label>
          <button
            type="button"
            className="border rounded px-4 py-3 text-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(order.pix!.code);
                setCopied(true);
              } catch {
                setError('Selecione e copie o código Pix acima.');
              }
            }}
          >
            {copied ? 'Código copiado' : 'Copiar código Pix'}
          </button>
          {order.pix.expiresAt && (
            <p className="text-xs">
              Válido até{' '}
              {new Date(order.pix.expiresAt).toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
              })}{' '}
              (Brasília).
            </p>
          )}
        </div>
      )}
      {order.paymentStatus === 'approved' && (
        <p className="text-sm">
          Pagamento confirmado. A preparação e a entrega serão atualizadas nos detalhes do pedido.
        </p>
      )}
      {['rejected', 'cancelled'].includes(order.paymentStatus) && (
        <p className="text-sm">
          O pagamento não foi concluído. Sua sacola foi mantida; você pode iniciar uma nova
          tentativa pelo checkout.
        </p>
      )}
      {['rejected', 'cancelled'].includes(order.paymentStatus) && (
        <a href="/checkout/information" className="block underline text-sm">
          Iniciar nova tentativa
        </a>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <Link href={`/conta/compras/${order.id}`} className="inline-block underline text-sm">
        Acompanhar meu pedido
      </Link>
    </section>
  );
}
