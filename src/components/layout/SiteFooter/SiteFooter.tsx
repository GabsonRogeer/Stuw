'use client';

import Link from 'next/link';
import { useStorefront } from '@/providers/storefront-provider';
import { usePersonalization } from '@/providers/personalization-provider';

export function SiteFooter() {
  const { setPanel } = useStorefront();
  const { openSettings } = usePersonalization();
  return (
    <footer className="border-t border-stuw-border dark:border-stuw-borderDark">
      <div className="page-container py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 text-xs">
        <div>
          <Link href="/" className="text-3xl tracking-[.25em] font-light">
            STUW
          </Link>
          <p className="text-stuw-slate mt-4">Movimento. Equilíbrio. Essência.</p>
        </div>
        <div className="space-y-3">
          <h2 className="eyebrow mb-4">Explorar</h2>
          <Link className="block" href="/atacado">
            Atacado
          </Link>
          <Link className="block" href="/produtos">
            Coleção
          </Link>
          <Link className="block" href="/produtos?tecido=SilkAir">
            SilkAir™
          </Link>
          <Link className="block" href="/#sensorial">
            O toque STUW
          </Link>
        </div>
        <div className="space-y-3">
          <h2 className="eyebrow mb-4">Podemos ajudar?</h2>
          <button className="block" onClick={() => setPanel('concierge')}>
            Fale com a STUW
          </button>
          <button className="block" onClick={() => setPanel('fit')}>
            Guia de tamanhos
          </button>
          <button className="block" onClick={() => setPanel('returns')}>
            Trocas e devoluções
          </button>
          <button className="block" onClick={openSettings}>
            Cookies e privacidade
          </button>
          <a
            className="block"
            href="https://www.instagram.com/stuw.company/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        </div>
        <div>
          <h2 className="eyebrow mb-4">STUW Privé</h2>
          <p className="text-stuw-slate mb-4">Novos drops, em primeira mão.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPanel('newsletter');
            }}
            className="flex border-b border-current pb-2 gap-2"
          >
            <input
              required
              type="email"
              aria-label="Seu e-mail"
              placeholder="Seu e-mail"
              className="min-w-0 w-full bg-transparent outline-none"
            />
            <button type="submit" className="underline">
              Cadastrar
            </button>
          </form>
        </div>
      </div>
      <div className="page-container py-5 border-t border-stuw-border dark:border-stuw-borderDark text-[10px] text-stuw-slate flex justify-between gap-4">
        <span>© {new Date().getFullYear()} STUW</span>
        <span>Brasil · BRL R$</span>
      </div>
    </footer>
  );
}
