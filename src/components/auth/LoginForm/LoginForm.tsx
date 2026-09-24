'use client';

import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button/button';
import { useTheme } from '@/hooks/use-theme';
import { usePersonalization } from '@/providers/personalization-provider';

export function LoginForm() {
  useTheme();
  const { ready, openSettings } = usePersonalization();
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // UI preview only. Connect the auth provider here when accounts are available.
    // Never persist credentials or simulate an authenticated session.
    const password = event.currentTarget.elements.namedItem('password');
    if (password instanceof HTMLInputElement) password.value = '';
    setShowPassword(false);
    setMessage('O acesso às contas ainda não está disponível. Nenhum dado foi enviado.');
  }

  return (
    <form
      method="post"
      onSubmit={handleSubmit}
      className="space-y-5"
      aria-describedby="login-availability"
    >
      <div>
        <label htmlFor="login-email" className="block text-sm mb-2">
          E-mail
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          placeholder="seu@email.com"
          className="w-full h-12 rounded-md border border-stuw-border dark:border-stuw-borderDark bg-transparent px-4 text-sm placeholder:text-stuw-slate/60"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm mb-2">
          Senha
        </label>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="Digite sua senha"
            className="w-full h-12 rounded-md border border-stuw-border dark:border-stuw-borderDark bg-transparent pl-4 pr-12 text-sm placeholder:text-stuw-slate/60"
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
            aria-controls="login-password"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-1 top-1 h-10 w-10 flex items-center justify-center text-stuw-slate hover:text-stuw-obsidian dark:hover:text-stuw-canvas"
          >
            {showPassword ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!ready}
        className="w-full !normal-case !tracking-normal !text-sm !font-medium rounded-md !py-4"
      >
        Entrar
      </Button>
      <p id="login-availability" className="text-xs text-stuw-slate leading-relaxed text-center">
        Estamos preparando seu acesso. Por enquanto, este formulário não realiza login nem envia
        seus dados.
      </p>
      {message && (
        <p
          role="status"
          className="text-xs leading-relaxed p-3 rounded-md bg-stuw-sand dark:bg-stone-800"
        >
          {message}
        </p>
      )}
      <div className="text-center">
        <button
          type="button"
          onClick={openSettings}
          className="underline text-[11px] text-stuw-slate"
        >
          Cookies e privacidade
        </button>
      </div>
    </form>
  );
}
