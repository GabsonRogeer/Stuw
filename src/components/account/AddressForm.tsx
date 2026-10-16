'use client';
import { useActionState, useId, useState } from 'react';
import { saveAddress, deleteAddress } from '@/app/conta/actions';
import { Button } from '@/components/ui/button/button';
import { STATES, type AddressInput } from '@/services/account';
import { formatPostalCode, postalAddressPatch, postalCodeDigits } from '@/services/postal-code';
import { usePostalCode } from '@/hooks/use-postal-code';
import { PostalCodeFeedback } from './PostalCodeFeedback';
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
  const emptyAddress = (): AddressInput => ({
    label: '',
    recipient: '',
    postal_code: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
  });
  const [values, setValues] = useState<AddressInput>(() => ({
    ...emptyAddress(),
    ...address,
    postal_code: formatPostalCode(address?.postal_code ?? ''),
  }));
  const [state, action, pending] = useActionState(
    async (previous: Parameters<typeof saveAddress>[0], form: FormData) => {
      const result = await saveAddress(previous, form);
      if (result.message && !address) setValues(emptyAddress());
      return result;
    },
    {},
  );
  const postal = usePostalCode();
  const feedbackId = useId();
  function lookupAddress(value: string) {
    const baseline = values;
    postal.lookup(value, (found) =>
      setValues((current) =>
        postalCodeDigits(current.postal_code) === found.postalCode
          ? { ...current, ...postalAddressPatch(current, baseline, found) }
          : current,
      ),
    );
  }
  return (
    <form action={action} onSubmit={postal.cancel} className="space-y-5">
      <input type="hidden" name="id" value={address?.id ?? ''} />
      <fieldset disabled={pending} className="grid sm:grid-cols-2 gap-5">
        {fields.map(([key, label, autoComplete, max]) => (
          <div key={key}>
            <label className="block text-sm">
              {label}
              <input
                name={key}
                value={values[key]}
                onChange={(event) => {
                  const value =
                    key === 'postal_code'
                      ? formatPostalCode(event.target.value)
                      : event.target.value;
                  setValues((current) => ({ ...current, [key]: value }));
                  if (key === 'postal_code') lookupAddress(value);
                }}
                required={key !== 'complement'}
                maxLength={max}
                autoComplete={autoComplete}
                inputMode={key === 'postal_code' ? 'numeric' : undefined}
                pattern={key === 'postal_code' ? '[0-9]{5}-?[0-9]{3}' : undefined}
                placeholder={key === 'postal_code' ? '00000-000' : undefined}
                aria-describedby={key === 'postal_code' ? feedbackId : undefined}
                className={accountInput + ' mt-2'}
              />
            </label>
            {key === 'postal_code' && (
              <div className="mt-2">
                <PostalCodeFeedback
                  id={feedbackId}
                  {...postal}
                  onRetry={() => lookupAddress(values.postal_code)}
                />
              </div>
            )}
          </div>
        ))}
        <label className="block text-sm">
          Estado
          <select
            name="state"
            value={values.state}
            onChange={(event) =>
              setValues((current) => ({ ...current, state: event.target.value }))
            }
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
