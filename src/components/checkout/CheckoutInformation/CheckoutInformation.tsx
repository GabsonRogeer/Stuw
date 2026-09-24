'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useCheckout } from '@/providers/checkout-provider';
import { useStorefront } from '@/providers/storefront-provider';
import { BRAZIL_STATES, DEMO_INFORMATION } from '@/services/checkout';
import { Button } from '@/components/ui/button/button';

const addressFields = [
  { name: 'firstName', label: 'Nome', autocomplete: 'given-name' },
  { name: 'lastName', label: 'Sobrenome', autocomplete: 'family-name' },
  {
    name: 'postalCode',
    label: 'CEP',
    autocomplete: 'postal-code',
    placeholder: '00000-000',
    pattern: '[0-9]{5}-?[0-9]{3}',
    inputMode: 'numeric',
    maxLength: 9,
    wide: true,
  },
  { name: 'street', label: 'Endereço', autocomplete: 'address-line1' },
  { name: 'number', label: 'Número', autocomplete: 'off' },
  {
    name: 'complement',
    label: 'Apartamento, bloco etc. (opcional)',
    autocomplete: 'address-line2',
    optional: true,
  },
  { name: 'district', label: 'Bairro', autocomplete: 'address-level3' },
  { name: 'city', label: 'Cidade', autocomplete: 'address-level2' },
] as const;

export function CheckoutInformation() {
  const { information, updateInformation, submitInformation } = useCheckout();
  const { setPanel } = useStorefront();
  const router = useRouter();
  const [error, setError] = useState('');
  return (
    <form
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitInformation()) router.push('/checkout/shipping');
        else setError('Confira os dados de contato e o endereço para continuar.');
      }}
      className="space-y-8"
    >
      <section>
        <div className="flex justify-between items-center gap-4 mb-5">
          <h1 className="font-serif text-3xl">Contato</h1>
          <button
            type="button"
            onClick={() => updateInformation(DEMO_INFORMATION)}
            className="underline text-xs"
          >
            Preencher demonstração
          </button>
        </div>
        <label className="block text-xs space-y-2">
          <span>E-mail</span>
          <input
            required
            type="email"
            autoComplete="email"
            name="email"
            value={information.email}
            onChange={(event) => updateInformation({ email: event.target.value })}
            className="field"
          />
        </label>
        <div className="space-y-3 mt-5">
          <label className="flex items-start gap-3 text-xs">
            <input
              type="checkbox"
              checked={information.emailOffers}
              onChange={(event) => updateInformation({ emailOffers: event.target.checked })}
              className="accent-stuw-sage mt-0.5"
            />
            Quero receber novidades e ofertas por e-mail.
          </label>
          <label className="flex items-start gap-3 text-xs">
            <input
              type="checkbox"
              checked={information.whatsappOffers}
              onChange={(event) => updateInformation({ whatsappOffers: event.target.checked })}
              className="accent-stuw-sage mt-0.5"
            />
            Quero receber novidades e ofertas por WhatsApp.
          </label>
        </div>
      </section>
      <section>
        <h2 className="font-serif text-2xl mb-5">Endereço de entrega</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-xs space-y-2 sm:col-span-2">
            <span>País / Região</span>
            <select
              name="country"
              autoComplete="country-name"
              className="field"
              defaultValue="Brasil"
            >
              <option>Brasil</option>
            </select>
          </label>
          {addressFields.map((field) => (
            <label
              key={field.name}
              className={`text-xs space-y-2 ${'wide' in field ? 'sm:col-span-2' : ''}`}
            >
              <span>{field.label}</span>
              <input
                required={!('optional' in field)}
                name={field.name}
                autoComplete={field.autocomplete}
                placeholder={'placeholder' in field ? field.placeholder : undefined}
                pattern={'pattern' in field ? field.pattern : undefined}
                inputMode={'inputMode' in field ? field.inputMode : undefined}
                maxLength={'maxLength' in field ? field.maxLength : 180}
                value={information[field.name]}
                onChange={(event) => updateInformation({ [field.name]: event.target.value })}
                className="field"
              />
            </label>
          ))}
          <label className="text-xs space-y-2">
            <span>Estado</span>
            <select
              required
              name="state"
              autoComplete="address-level1"
              value={information.state}
              onChange={(event) => updateInformation({ state: event.target.value })}
              className="field"
            >
              <option value="">Selecione</option>
              {BRAZIL_STATES.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <label className="text-xs space-y-2 sm:col-span-2">
            <span>Telefone com DDD</span>
            <input
              required
              type="tel"
              name="phone"
              autoComplete="tel-national"
              maxLength={16}
              placeholder="(11) 99999-9999"
              value={information.phone}
              onChange={(event) => updateInformation({ phone: event.target.value })}
              className="field"
            />
          </label>
        </div>
      </section>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-5 pt-3">
        <button
          type="button"
          onClick={() => setPanel('cart')}
          className="inline-flex items-center gap-2 text-xs"
        >
          <ArrowLeft size={14} /> Voltar para o carrinho
        </button>
        <Button
          type="submit"
          className="rounded-xl w-full sm:w-auto !normal-case !tracking-normal !py-4"
        >
          Continuar para frete
        </Button>
      </div>
      <p className="text-[11px] text-stuw-slate">
        Checkout de demonstração. Nenhum pedido ou dado será enviado.
      </p>
    </form>
  );
}
