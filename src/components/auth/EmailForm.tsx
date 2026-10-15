'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import type { AuthState } from '@/app/auth/actions';
import {
  requestPasswordReset,
  resendConfirmation,
  updatePassword,
  verifyEmailLink,
} from '@/app/auth/email-actions';
import { Button } from '@/components/ui/button/button';

const fieldClass =
  'w-full h-12 rounded-md border border-stuw-border dark:border-stuw-borderDark bg-transparent px-4 text-sm';

export function EmailForm({
  mode,
  token = '',
  tokenType = '',
}: {
  mode: 'recovery' | 'resend' | 'password' | 'verify';
  token?: string;
  tokenType?: string;
}) {
  const handler =
    mode === 'recovery'
      ? requestPasswordReset
      : mode === 'resend'
        ? resendConfirmation
        : mode === 'password'
          ? updatePassword
          : verifyEmailLink;
  const [state, action, pending] = useActionState<AuthState, FormData>(handler, {});
  const complete = Boolean(state.message);
  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending || complete} className="space-y-5 disabled:opacity-60">
        {mode === 'verify' ? (
          <>
            <input type="hidden" name="token_hash" value={token} />
            <input type="hidden" name="type" value={tokenType} />
          </>
        ) : mode === 'password' ? (
          <>
            <label className="block text-sm">
              Nova senha
              <input
                className={fieldClass + ' mt-2'}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                aria-describedby="new-password-hint"
              />
            </label>
            <p id="new-password-hint" className="text-xs text-stuw-slate">
              Use entre 8 e 128 caracteres.
            </p>
            <label className="block text-sm">
              Confirme a nova senha
              <input
                className={fieldClass + ' mt-2'}
                name="confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </label>
          </>
        ) : (
          <label className="block text-sm">
            E-mail
            <input
              className={fieldClass + ' mt-2'}
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
            />
          </label>
        )}
        <Button type="submit" className="w-full rounded-md !normal-case !tracking-normal !text-sm">
          {pending
            ? 'Aguarde…'
            : mode === 'password'
              ? 'Salvar nova senha'
              : mode === 'verify'
                ? 'Continuar'
                : mode === 'recovery'
                  ? 'Enviar link de recuperação'
                  : 'Reenviar confirmação'}
        </Button>
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
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
      {mode === 'password' && complete && (
        <Link href="/conta" className="block text-sm underline">
          Acessar minha conta
        </Link>
      )}
      {mode === 'verify' && state.error && (
        <Link
          href={tokenType === 'recovery' ? '/esqueci-senha' : '/reenviar-confirmacao'}
          className="block text-sm underline"
        >
          Solicitar novo link
        </Link>
      )}
      <Link href="/login" className="block text-center text-sm underline">
        Voltar ao login
      </Link>
    </form>
  );
}
