import { AuthCard } from '@/components/auth/AuthCard';
import { EmailForm } from '@/components/auth/EmailForm';
export const metadata = { title: 'Recuperar senha', robots: { index: false, follow: false } };
export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Recuperar senha">
      <p className="text-sm leading-relaxed mb-6">
        Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
      </p>
      <EmailForm mode="recovery" />
    </AuthCard>
  );
}
