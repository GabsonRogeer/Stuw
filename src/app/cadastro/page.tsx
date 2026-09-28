import type { Metadata } from 'next';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthForm } from '@/components/auth/AuthForm';
export const metadata: Metadata = { title: 'Criar conta', robots: { index: false, follow: false } };
export default function RegistrationPage() {
  return (
    <AuthCard title="Criar conta">
      <AuthForm signup />
    </AuthCard>
  );
}
