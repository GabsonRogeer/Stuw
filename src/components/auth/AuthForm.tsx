'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { login, register, type AuthState } from '@/app/auth/actions';
import { Button } from '@/components/ui/button/button';
import { useTheme } from '@/hooks/use-theme';
import { usePersonalization } from '@/providers/personalization-provider';
const fieldClass =
  'w-full h-12 rounded-md border border-stuw-border dark:border-stuw-borderDark bg-transparent px-4 text-sm';
export function AuthForm({ signup = false, next = '' }: { signup?: boolean; next?: string }) {
  useTheme();
  const { ready, openSettings } = usePersonalization();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup ? register : login,
    {},
  );
  const [visible, setVisible] = useState(false);
  const [validationError, setValidationError] = useState('');
  return (
    <form
      action={action}
      className="space-y-5"
      aria-busy={pending}
      onSubmit={(event) => {
        setValidationError('');
        if (signup) {
          const data = new FormData(event.currentTarget);
          if (data.get('password') !== data.get('confirmation')) {
            event.preventDefault();
            setValidationError('As senhas não coincidem.');
            (event.currentTarget.elements.namedItem('confirmation') as HTMLInputElement)?.focus();
          }
        }
      }}
    >
      <fieldset disabled={pending || !ready} className="space-y-5 disabled:opacity-60">
        <input type="hidden" name="next" value={next} />
        {signup && (
          <div>
            <label htmlFor="auth-name" className="block text-sm mb-2">
              Nome
            </label>
            <input
              id="auth-name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={200}
              className={fieldClass}
            />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="block text-sm mb-2">
            E-mail
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="block text-sm mb-2">
            Senha
          </label>
          <div className="relative">
            <input
              id="auth-password"
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              minLength={signup ? 8 : undefined}
              maxLength={128}
              className={fieldClass + ' pr-12'}
              aria-describedby={signup ? 'password-hint' : undefined}
            />
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={visible}
              aria-controls="auth-password"
              className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center"
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {signup && (
            <p id="password-hint" className="mt-2 text-xs text-stuw-slate">
              Use pelo menos 8 caracteres.
            </p>
          )}
        </div>
        {signup && (
          <div>
            <label htmlFor="auth-confirmation" className="block text-sm mb-2">
              Confirmação de senha
            </label>
            <input
              id="auth-confirmation"
              name="confirmation"
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              className={fieldClass}
            />
          </div>
        )}
        <Button type="submit" className="w-full rounded-md !normal-case !tracking-normal !text-sm">
          {pending ? 'Aguarde…' : signup ? 'Criar conta' : 'Entrar'}
        </Button>
      </fieldset>
      {(validationError || state.error) && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {validationError || state.error}
        </p>
      )}
      {state.message && (
        <p
          role="status"
          className="text-sm leading-relaxed bg-stuw-sand dark:bg-stone-800 p-4 rounded-md"
        >
          {state.message}
        </p>
      )}
      <p className="text-sm text-center">
        {signup ? 'Já tem uma conta? ' : 'Ainda não tem conta? '}
        <Link className="underline" href={signup ? '/login' : '/cadastro'}>
          {signup ? 'Entrar' : 'Criar conta'}
        </Link>
      </p>
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
