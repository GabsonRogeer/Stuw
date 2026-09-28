'use client';
import { useActionState } from 'react';
import { saveProfile } from '@/app/conta/actions';
import { Button } from '@/components/ui/button/button';
export const accountInput =
  'w-full rounded-md border border-stuw-border dark:border-stuw-borderDark bg-white dark:bg-stone-900 px-3 py-3 text-sm';
export function ProfileForm({
  name,
  birthDate,
  phone,
  email,
}: {
  name: string;
  birthDate: string;
  phone: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(saveProfile, {});
  return (
    <form action={action} className="space-y-7 max-w-2xl">
      <fieldset disabled={pending} className="space-y-5">
        <legend className="font-medium mb-5">Informações pessoais</legend>
        <label className="block text-sm">
          Nome completo
          <input
            name="full_name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={200}
            defaultValue={name}
            className={accountInput + ' mt-2'}
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-5">
          <label className="block text-sm">
            Data de nascimento
            <input
              name="birth_date"
              type="date"
              min="1900-01-01"
              max={new Date().toISOString().slice(0, 10)}
              autoComplete="bday"
              defaultValue={birthDate}
              className={accountInput + ' mt-2'}
            />
          </label>
          <label className="block text-sm">
            Telefone
            <input
              name="phone"
              type="tel"
              autoComplete="tel-national"
              maxLength={20}
              placeholder="(11) 99999-9999"
              defaultValue={phone}
              className={accountInput + ' mt-2'}
            />
          </label>
        </div>
      </fieldset>
      <fieldset className="border-t border-stuw-border dark:border-stuw-borderDark pt-6">
        <legend className="font-medium px-1">Acesso à conta</legend>
        <label className="block text-sm mt-3">
          E-mail
          <input
            value={email}
            readOnly
            type="email"
            className={accountInput + ' mt-2 opacity-70'}
          />
        </label>
        <p className="text-xs text-stuw-slate mt-2">
          Seu e-mail de acesso. A alteração de e-mail ainda não está disponível.
        </p>
      </fieldset>
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
      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar alterações'}
      </Button>
    </form>
  );
}
