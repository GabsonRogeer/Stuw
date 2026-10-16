'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { SiteHeader } from '@/components/layout/SiteHeader/SiteHeader';
import { PaymentStatus } from '@/components/checkout/PaymentStatus';
import { useCheckout } from '@/providers/checkout-provider';
import { useStorefront } from '@/providers/storefront-provider';
import { usePersonalization } from '@/providers/personalization-provider';
import { useTheme } from '@/hooks/use-theme';
import { checkoutRedirect, type CheckoutStep } from '@/services/checkout';
import { CheckoutSummary } from '@/components/checkout/CheckoutSummary/CheckoutSummary';

const steps: { id: CheckoutStep; label: string }[] = [
  { id: 'information', label: 'Informações' },
  { id: 'shipping', label: 'Frete' },
  { id: 'payment', label: 'Pagamento' },
];

export function CheckoutShell({ children }: { children: ReactNode }) {
  useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { ready, items, informationValid, shipping, order, recoveryError } = useCheckout();
  const { setPanel } = useStorefront();
  const { openSettings } = usePersonalization();
  const step = steps.find((entry) => pathname === `/checkout/${entry.id}`)?.id ?? 'information';
  const redirectTo = checkoutRedirect(step, informationValid, Boolean(shipping));
  useEffect(() => {
    if (ready && items.length && !order && !recoveryError && redirectTo) router.replace(redirectTo);
  }, [ready, items.length, order, recoveryError, redirectTo, router]);

  return (
    <div className="checkout-shell min-h-screen">
      <SiteHeader compact />
      <div className="page-container py-8 sm:py-12">
        <header className="mb-9">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow">Sua compra STUW</p>
            <Link
              href="/produtos"
              className="inline-flex items-center gap-2 text-xs text-stuw-sage dark:text-stuw-champagne"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Voltar para a loja
            </Link>
          </div>
          <nav
            aria-label="Etapas do checkout"
            className="mt-7 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs"
          >
            <button type="button" onClick={() => setPanel('cart')} className="hover:underline">
              Carrinho
            </button>
            {steps.map((entry) => {
              const enabled =
                entry.id === 'information' ||
                (entry.id === 'shipping'
                  ? informationValid
                  : informationValid && Boolean(shipping));
              return (
                <span key={entry.id} className="inline-flex items-center gap-2">
                  <ChevronRight size={13} className="text-stuw-slate" aria-hidden="true" />
                  {entry.id === step ? (
                    <span aria-current="step" className="font-semibold">
                      {entry.label}
                    </span>
                  ) : enabled && !order ? (
                    <Link href={`/checkout/${entry.id}`} className="hover:underline">
                      {entry.label}
                    </Link>
                  ) : (
                    <span className="text-stuw-slate">{entry.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
        </header>

        <main>
          {!ready ? (
            <p role="status" className="py-20 text-center">
              Carregando sua sacola…
            </p>
          ) : recoveryError ? (
            <section className="max-w-lg mx-auto py-12 space-y-5">
              <h1 className="font-serif text-3xl">Acompanhe seu pedido</h1>
              <p role="alert">{recoveryError}</p>
              <p className="text-sm">Confira suas compras antes de iniciar outro pagamento.</p>
              <Link href="/conta/compras" className="underline text-sm">
                Abrir minhas compras
              </Link>
            </section>
          ) : order ? (
            <PaymentStatus initial={order} clearCart />
          ) : !items.length ? (
            <section className="text-center py-20 space-y-5">
              <h1 className="font-serif text-4xl">Sua sacola está vazia.</h1>
              <Link href="/produtos" className="text-sm underline">
                Explorar coleção
              </Link>
            </section>
          ) : redirectTo ? (
            <p role="status" className="py-20">
              Retomando a etapa anterior…
            </p>
          ) : (
            <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-10 lg:gap-16">
              <div className="min-w-0">{children}</div>
              <CheckoutSummary />
            </div>
          )}
        </main>
        <footer className="mt-12 pt-6 border-t border-stuw-border dark:border-stuw-borderDark flex flex-wrap gap-5 text-[11px] text-stuw-slate">
          <button onClick={() => setPanel('returns')} className="underline">
            Trocas e devoluções
          </button>
          <button onClick={openSettings} className="underline">
            Cookies e privacidade
          </button>
          <button onClick={() => setPanel('concierge')} className="underline">
            Contato
          </button>
          <span className="sm:ml-auto">© {new Date().getFullYear()} STUW</span>
        </footer>
      </div>
    </div>
  );
}
