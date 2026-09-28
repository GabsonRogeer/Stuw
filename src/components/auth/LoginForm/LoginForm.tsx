import { AuthForm } from '@/components/auth/AuthForm';

export function LoginForm({ next = '' }: { next?: string }) {
  return <AuthForm next={next} />;
}
