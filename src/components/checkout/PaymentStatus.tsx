'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { checkOrderPayment } from '@/app/actions/order';
import { PAYMENT_LABELS, type CheckoutPaymentResult } from '@/services/fulfillment';
import { currency } from '@/lib/commerce';
import { useCart } from '@/providers/cart-provider';
import { Check, Clock3, Copy, Mail, QrCode, ReceiptText, ShieldCheck } from 'lucide-react';
import { pixCountdown } from '@/services/pix-countdown';
import './payment-status.css';

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
  const [now, setNow] = useState<number | null>(null);
  const { clear } = useCart();
  const cleared = useRef(false);
  const terminal = ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(
    order.paymentStatus,
  );
  const pixDeadline = Date.parse(order.pix?.expiresAt ?? '');
  const pendingPix = order.paymentStatus === 'pending' && Boolean(order.pix);
  const pixExpired = pendingPix && now !== null && pixDeadline <= now;
  const pixAvailable = pendingPix && now !== null && pixDeadline > now;
  const countdown = now === null ? null : pixCountdown(order.pix?.expiresAt ?? '', now);
  const approved = order.paymentStatus === 'approved';
  useEffect(() => {
    if (!pendingPix) return;
    const tick = () => setNow(Date.now());
    // Keep SSR and hydration identical; only offer the code after checking the clock.
    const initialTick = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearTimeout(initialTick);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [pendingPix]);
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
    }, 5000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [initial.id, terminal]);
  return (
    <section className={`payment-status glass-card ${approved ? 'payment-status-success' : ''}`}>
      {order.testMode && (
        <p className="text-sm border rounded p-3">
          Ambiente de teste. Não faça transferências nem use dados de cartão real.
        </p>
      )}
      <div className="payment-symbol" aria-hidden="true">
        {approved ? <Check size={30} strokeWidth={1.4} /> : <QrCode size={28} strokeWidth={1.3} />}
      </div>
      <p className="eyebrow break-all">Pedido {order.code}</p>
      <h1 className="font-serif text-3xl" role="status">
        {order.paymentIssue?.kind === 'request_rejected'
          ? 'Não foi possível iniciar o pagamento'
          : pixExpired
            ? 'Código Pix vencido'
            : approved
              ? 'Pagamento concluído'
              : (PAYMENT_LABELS[order.paymentStatus] ?? 'Conferindo pagamento')}
      </h1>
      <p className="payment-total">{currency(order.total)}</p>
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
      {pendingPix && !pixAvailable && (
        <p className="text-sm" role="status">
          {pixExpired
            ? 'O prazo deste código terminou. Estamos conferindo o resultado com o Mercado Pago. Aguarde a confirmação antes de iniciar outra compra.'
            : 'Conferindo a validade do Pix. Aguarde antes de realizar o pagamento.'}
        </p>
      )}
      {pixAvailable && order.pix && (
        <div className="space-y-6">
          {countdown && (
            <div className="pix-countdown">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-xs font-medium">
                    <Clock3 size={14} aria-hidden="true" /> Tempo para pagar
                  </p>
                  <p className="mt-2 text-xs text-stuw-slate">
                    {countdown.inCycles
                      ? `Etapa ${countdown.cycle} de 3 · ${countdown.cycleLabel} nesta etapa`
                      : 'Seu Pix está pronto para pagamento'}
                  </p>
                </div>
                <span
                  className="pix-time"
                  role="timer"
                  aria-label={`Tempo restante para pagar: ${countdown.label}`}
                >
                  {countdown.label}
                </span>
              </div>
              <div
                className="pix-cycle-bars"
                role="progressbar"
                aria-label="Tempo disponível para pagar o Pix"
                aria-valuemin={0}
                aria-valuemax={1800}
                aria-valuenow={Math.min(1800, countdown.remaining)}
                aria-valuetext={`${countdown.label} restantes`}
              >
                {countdown.segments.map((fraction, index) => (
                  <span className="pix-cycle-track" key={index}>
                    <span style={{ transform: `scaleX(${fraction})` }} />
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-stuw-slate">
                O prazo é contínuo. A mudança de etapa não renova o código.
              </p>
            </div>
          )}
          <p className="text-sm text-stuw-slate">
            Escaneie o QR Code no aplicativo do seu banco ou copie o código Pix.
          </p>
          <div className="pix-code-image">
            <Image
              unoptimized
              src={`data:image/png;base64,${order.pix.image}`}
              alt="QR Code para pagamento Pix"
              width={240}
              height={240}
            />
          </div>
          <label className="block text-xs">
            Código Pix
            <textarea
              readOnly
              value={order.pix.code}
              className="field mt-2 pix-code-text"
              rows={3}
            />
          </label>
          <button
            type="button"
            className="pix-copy-button"
            onClick={async () => {
              // A suspended tab may not have processed the expiry timer yet.
              if (pixDeadline <= Date.now()) {
                setNow(Date.now());
                return;
              }
              try {
                await navigator.clipboard.writeText(order.pix!.code);
                setCopied(true);
              } catch {
                setError('Selecione e copie o código Pix acima.');
              }
            }}
          >
            {copied ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copied ? 'Código copiado' : 'Copiar código Pix'}
          </button>
          {order.pix.expiresAt && (
            <p className="text-xs text-center text-stuw-slate">
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
        <div className="payment-success-details">
          <p className="text-sm leading-relaxed text-stuw-slate">
            Recebemos seu pagamento. Agora vamos cuidar dos próximos passos do seu pedido.
          </p>
          <div className="payment-next-step">
            <Mail size={19} aria-hidden="true" />
            <p>Em breve, você receberá a confirmação da compra por e-mail.</p>
          </div>
          <div className="payment-next-step">
            <ReceiptText size={19} aria-hidden="true" />
            <p>
              Assim que a nota fiscal for emitida, enviaremos os arquivos por e-mail. Ela também
              ficará disponível no seu pedido.
            </p>
          </div>
        </div>
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
      <Link href={`/conta/compras/${order.id}`} className="payment-order-link">
        Acompanhar meu pedido
      </Link>
      <p className="payment-secure">
        <ShieldCheck size={14} aria-hidden="true" /> Pagamento processado com segurança pelo Mercado
        Pago
      </p>
    </section>
  );
}
