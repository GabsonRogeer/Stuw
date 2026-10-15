'use client';
import { useActionState, type ReactNode } from 'react';
import { operationalAction } from '@/app/operacao/actions';

export function OperationalForm({
  children,
  fields,
  label = 'Salvar',
}: {
  children?: ReactNode;
  fields: Record<string, string | number>;
  label?: string;
}) {
  const [state, action, pending] = useActionState(operationalAction, {});
  return (
    <form action={action} className="space-y-3">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <fieldset disabled={pending} className="space-y-3">
        {children}
      </fieldset>
      <button
        disabled={pending}
        className="rounded bg-stuw-obsidian px-4 py-2 text-white disabled:opacity-50 dark:bg-stuw-canvas dark:text-stuw-obsidian"
      >
        {pending ? 'Salvando…' : label}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
