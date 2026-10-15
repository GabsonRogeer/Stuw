import { AuthCard } from '@/components/auth/AuthCard';
import { EmailForm } from '@/components/auth/EmailForm';
export const metadata = { title: 'Reenviar confirmação', robots: { index: false, follow: false } };
export default function ResendPage() {
  return (
    <AuthCard title="Confirmar e-mail">
      <p className="text-sm leading-relaxed mb-6">
        Ainda não confirmou seu cadastro? Solicite um novo link para acessar sua conta STUW.
      </p>
      <EmailForm mode="resend" />
    </AuthCard>
  );
}
