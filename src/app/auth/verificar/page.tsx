import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
import { EmailForm } from '@/components/auth/EmailForm';
export const metadata = {
  title: 'Validar acesso',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  const valid =
    typeof token_hash === 'string' &&
    token_hash.length > 0 &&
    token_hash.length <= 512 &&
    (type === 'email' || type === 'recovery');
  return (
    <AuthCard title={type === 'recovery' ? 'Recuperar acesso' : 'Confirmar e-mail'}>
      {valid ? (
        <>
          <p className="text-sm leading-relaxed mb-6">
            {type === 'recovery'
              ? 'Continue para validar o link e escolher sua nova senha.'
              : 'Continue para confirmar seu e-mail e acessar sua conta STUW.'}
          </p>
          <EmailForm mode="verify" token={token_hash} tokenType={type} />
        </>
      ) : (
        <>
          <p className="text-sm">Este link é inválido. Solicite um novo e-mail.</p>
          <Link href="/login" className="block underline mt-6">
            Voltar ao login
          </Link>
        </>
      )}
    </AuthCard>
  );
}
