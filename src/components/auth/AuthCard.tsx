import Link from 'next/link';
import type { ReactNode } from 'react';
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col items-center px-5 py-10 sm:py-16">
      <Link
        href="/"
        aria-label="STUW — voltar à loja"
        className="text-4xl tracking-[.26em] pl-[.26em] font-light"
      >
        STUW
      </Link>
      <p className="mt-3 text-[9px] tracking-[.25em] uppercase text-stuw-slate">
        Activewear & Wellness
      </p>
      <main className="w-full max-w-[480px] mt-10">
        <section className="rounded-xl border border-stuw-border/50 dark:border-stuw-borderDark bg-white dark:bg-stone-900 px-6 py-9 sm:p-12 shadow-[0_4px_30px_rgba(19,20,19,0.05)]">
          <h1 className="font-serif text-4xl text-center mb-8">{title}</h1>
          {children}
        </section>
        <div className="text-center mt-7">
          <Link href="/" className="text-xs underline text-stuw-slate">
            Voltar à loja
          </Link>
        </div>
      </main>
      <footer className="mt-10 text-xs text-stuw-slate">© {new Date().getFullYear()} STUW</footer>
    </div>
  );
}
