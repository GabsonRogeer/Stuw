'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { validateRegistration, authErrorMessage } from '@/services/auth';
export type AuthState = { error?: string; message?: string };
export async function login(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password || email.length > 254 || password.length > 128)
    return { error: 'Informe seu e-mail e senha.' };
  let destination = '/conta';
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: authErrorMessage(error.code) };
    const { data: admin } = await supabase.rpc('is_admin');
    if (admin === true) destination = '/admin';
  } catch {
    return { error: authErrorMessage() };
  }
  revalidatePath('/', 'layout');
  redirect(destination);
}
export async function register(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = {
    name: String(form.get('name') ?? '').trim(),
    email: String(form.get('email') ?? '').trim(),
    password: String(form.get('password') ?? ''),
    confirmation: String(form.get('confirmation') ?? ''),
  };
  const invalid = validateRegistration(input);
  if (invalid) return { error: invalid };
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl)
      return { error: 'O cadastro está sendo configurado. Tente novamente em instantes.' };
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.name },
        emailRedirectTo: new URL('/auth/callback', siteUrl).href,
      },
    });
    if (error) {
      // Only diagnostic codes: never log form data, passwords, emails or tokens.
      console.warn('[auth.register] Supabase recusou o cadastro', {
        code: error.code ?? 'unknown',
        status: error.status,
      });
      return { error: authErrorMessage(error.code) };
    }
    if (!data.session)
      return {
        message:
          'Se o cadastro puder ser concluído, você receberá um e-mail de confirmação. Confira sua caixa de entrada e o spam. Se já tem conta, faça login.',
      };
  } catch {
    return { error: authErrorMessage() };
  }
  revalidatePath('/', 'layout');
  redirect('/conta');
}
export async function logout(): Promise<AuthState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) return { error: 'Não foi possível sair. Tente novamente.' };
  } catch {
    return { error: authErrorMessage() };
  }
  revalidatePath('/', 'layout');
  redirect('/login');
}
