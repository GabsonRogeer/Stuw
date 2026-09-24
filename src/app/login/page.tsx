import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm/LoginForm';

export const metadata: Metadata = {
  title: 'Entrar na minha conta',
  description: 'Acesse sua conta STUW com e-mail e senha.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="min-h-svh flex flex-col items-center px-5 py-10 sm:py-16">
      <header className="text-center">
        <Link
          href="/"
          aria-label="STUW — voltar à loja"
          className="inline-block text-4xl sm:text-5xl font-light tracking-[.26em] pl-[.26em]"
        >
          STUW
        </Link>
        <p className="mt-3 text-[9px] tracking-[.25em] uppercase text-stuw-slate">
          Activewear & Wellness
        </p>
      </header>

      <main className="w-full max-w-[480px] mt-10 sm:mt-12">
        <section
          aria-labelledby="login-title"
          className="rounded-xl border border-stuw-border/50 dark:border-stuw-borderDark bg-white dark:bg-stone-900 px-6 py-9 sm:p-12 shadow-[0_4px_30px_rgba(19,20,19,0.05)]"
        >
          <div className="text-center mb-8">
            <h1 id="login-title" className="font-serif text-4xl">
              Fazer login
            </h1>
            <p className="text-sm text-stuw-slate mt-3">Seu espaço na STUW.</p>
          </div>
          <LoginForm />
        </section>
        <div className="text-center mt-7">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-stuw-slate hover:text-stuw-obsidian dark:hover:text-stuw-canvas"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Voltar à loja
          </Link>
        </div>
      </main>

      <footer className="text-center mt-10 text-[11px] text-stuw-slate">
        <div className="w-24 mx-auto border-t border-stuw-border dark:border-stuw-borderDark mb-5" />
        © {new Date().getFullYear()} STUW
      </footer>
    </div>
  );
}
