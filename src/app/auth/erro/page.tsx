import Link from 'next/link';
import { AuthCard } from '@/components/auth/AuthCard';
export const metadata = { title: 'Confirmar e-mail', robots: { index: false, follow: false } };
export default function ConfirmationError() {
  return (
    <AuthCard title="Confirmar e-mail">
      <p className="text-sm leading-relaxed">
        Não foi possível abrir sua sessão. O link pode ter expirado ou já ter sido usado. Se você já
        confirmou seu e-mail, entre com sua senha. Para o link padrão, use o mesmo navegador em que
        fez o cadastro.
      </p>
      <Link href="/login" className="block underline mt-6">
        Ir para o login
      </Link>
    </AuthCard>
  );
}
