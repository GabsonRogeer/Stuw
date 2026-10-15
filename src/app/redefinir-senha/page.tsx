import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { EmailForm } from '@/components/auth/EmailForm';
import { createClient } from '@/lib/supabase/server';
export const metadata = { title: 'Nova senha', robots: { index: false, follow: false } };
export default async function ResetPasswordPage() {
  let authenticated = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    authenticated = !error && Boolean(data.user);
  } catch {
    /* Render a recovery link when Auth is unavailable. */
  }
  return (
    <AuthCard title="Nova senha">
      {authenticated ? (
        <EmailForm mode="password" />
      ) : (
        <>
          <p className="text-sm">
            Abra o link enviado ao seu e-mail para criar uma nova senha. Se o link expirou, solicite
            outro.
          </p>
          <Link href="/esqueci-senha" className="block underline mt-6">
            Solicitar link de recuperação
          </Link>
        </>
      )}
    </AuthCard>
  );
}
