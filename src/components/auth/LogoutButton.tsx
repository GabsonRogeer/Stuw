'use client';
import { useActionState } from 'react';
import { logout, type AuthState } from '@/app/auth/actions';
import { Button } from '@/components/ui/button/button';
import { useTheme } from '@/hooks/use-theme';
export function LogoutButton() {
  useTheme();
  const [state, action, pending] = useActionState<AuthState>(logout, {});
  return (
    <form action={action}>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saindo…' : 'Sair da conta'}
      </Button>
      {state.error && (
        <p role="alert" className="mt-3 text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}
