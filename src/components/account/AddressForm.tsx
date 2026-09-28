'use client';
import { useActionState } from 'react';
import { saveAddress, deleteAddress } from '@/app/conta/actions';
import { Button } from '@/components/ui/button/button';
import { STATES } from '@/services/account';
import type { Address } from '@/types/database';
import { accountInput } from './ProfileForm';
const fields = [
  ['label', 'Identificação (ex.: Casa)', 'off', 200],
  ['recipient', 'Nome do destinatário', 'shipping name', 200],
  ['postal_code', 'CEP', 'shipping postal-code', 9],
  ['street', 'Endereço', 'shipping address-line1', 200],
  ['number', 'Número', 'off', 20],
  ['complement', 'Complemento (opcional)', 'shipping address-line2', 200],
  ['district', 'Bairro', 'shipping address-level3', 200],
  ['city', 'Cidade', 'shipping address-level2', 200],
] as const;
export function AddressForm({ address }: { address?: Address }) {
  const [state, action, pending] = useActionState(saveAddress, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={address?.id ?? ''} />
      <fieldset disabled={pending} className="grid sm:grid-cols-2 gap-5">
        {fields.map(([key, label, autoComplete, max]) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              name={key}
              defaultValue={address?.[key] ?? ''}
              required={key !== 'complement'}
              maxLength={max}
              autoComplete={autoComplete}
              inputMode={key === 'postal_code' ? 'numeric' : undefined}
              className={accountInput + ' mt-2'}
            />
          </label>
        ))}
        <label className="block text-sm">
          Estado
          <select
            name="state"
            defaultValue={address?.state ?? ''}
            required
            autoComplete="shipping address-level1"
            className={accountInput + ' mt-2'}
          >
            <option value="">Selecione</option>
            {STATES.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <p className="text-sm self-center text-stuw-slate">País: Brasil</p>
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
        {pending ? 'Salvando…' : address ? 'Salvar endereço' : 'Adicionar endereço'}
      </Button>
    </form>
  );
}
export function DeleteAddress({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteAddress, {});
  return (
    <form
      action={action}
      className="mt-5"
      onSubmit={(event) => {
        if (!window.confirm('Excluir este endereço de entrega?')) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm underline text-red-700 dark:text-red-300"
      >
        {pending ? 'Excluindo…' : 'Excluir endereço'}
      </button>
      {state.error && (
        <p role="alert" className="text-sm mt-2">
          {state.error}
        </p>
      )}
    </form>
  );
}
