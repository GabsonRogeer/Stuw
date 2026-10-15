'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { AuthState } from './actions';

function emailInput(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

async function requestEmail(form: FormData, recovery: boolean): Promise<AuthState> {
  const email = emailInput(form);
  if (!email) return { error: 'Informe um e-mail válido.' };
  try {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '');
    const supabase = await createClient();
    const { error } = recovery
      ? await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: new URL('/auth/callback?next=recovery', site).href,
        })
      : await supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: new URL('/auth/callback', site).href },
        });
    if (error) {
      if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(error.code ?? ''))
        return { error: 'Muitas solicitações. Aguarde alguns minutos antes de tentar novamente.' };
      // Do not disclose whether this email is registered or already confirmed.
      if (
        !['user_not_found', 'email_not_confirmed', 'email_exists', 'user_already_exists'].includes(
          error.code ?? '',
        )
      )
        return {
          error: 'Não foi possível solicitar o e-mail agora. Tente novamente em instantes.',
        };
    }
    return {
      message: recovery
        ? 'Se houver uma conta para este e-mail, você receberá um link para redefinir sua senha. Confira a caixa de entrada e o spam.'
        : 'Se houver um cadastro aguardando confirmação, você receberá um novo link. Confira a caixa de entrada e o spam.',
    };
  } catch {
    return { error: 'Não foi possível solicitar o e-mail agora. Tente novamente em instantes.' };
  }
}

export async function requestPasswordReset(_state: AuthState, form: FormData) {
  return requestEmail(form, true);
}

export async function resendConfirmation(_state: AuthState, form: FormData) {
  return requestEmail(form, false);
}

export async function verifyEmailLink(_state: AuthState, form: FormData): Promise<AuthState> {
  const token_hash = String(form.get('token_hash') ?? '');
  const type = String(form.get('type') ?? '');
  if (!token_hash || token_hash.length > 512 || !['email', 'recovery'].includes(type))
    return { error: 'Link inválido. Solicite um novo e-mail.' };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'recovery',
    });
    if (error) return { error: 'Este link expirou ou já foi usado. Solicite um novo e-mail.' };
  } catch {
    return { error: 'Não foi possível validar o link. Tente novamente.' };
  }
  revalidatePath('/', 'layout');
  redirect(type === 'recovery' ? '/redefinir-senha' : '/conta');
}

export async function updatePassword(_state: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get('password') ?? '');
  if (password.length < 8 || password.length > 128)
    return { error: 'Use uma senha entre 8 e 128 caracteres.' };
  if (password !== String(form.get('confirmation') ?? ''))
    return { error: 'As senhas não coincidem.' };
  try {
    const supabase = await createClient();
    const { data, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !data.user)
      return { error: 'Sua sessão expirou. Solicite um novo link de recuperação.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error)
      return {
        error:
          error.code === 'same_password'
            ? 'Escolha uma senha diferente da atual.'
            : error.code === 'weak_password'
              ? 'Escolha uma senha mais forte, com letras, números e símbolos.'
              : 'Não foi possível atualizar a senha. Solicite um novo link e tente novamente.',
      };
    // Invalidate refresh sessions on other devices after a password reset.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
    revalidatePath('/', 'layout');
    return {
      message: signOutError
        ? 'Senha atualizada. Não foi possível encerrar as outras sessões agora.'
        : 'Senha atualizada com sucesso. Você já pode acessar sua conta.',
    };
  } catch {
    return { error: 'Não foi possível concluir agora. Tente novamente.' };
  }
}
