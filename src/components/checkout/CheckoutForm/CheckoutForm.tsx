'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, ArrowLeft } from 'lucide-react';
import { useCart } from '@/providers/cart-provider';
import { calculateTotals, currency, itemKey } from '@/lib/commerce';
import { OrderSummary } from '@/components/cart/OrderSummary/OrderSummary';
import { Button } from '@/components/ui/button/button';

const fields = [
  { name: 'name', label: 'Nome completo', autoComplete: 'name', type: 'text' },
  { name: 'email', label: 'E-mail', autoComplete: 'email', type: 'email' },
  {
    name: 'postalCode',
    label: 'CEP',
    autoComplete: 'postal-code',
    type: 'text',
    pattern: '[0-9]{5}-?[0-9]{3}',
  },
  { name: 'street', label: 'Rua', autoComplete: 'address-line1', type: 'text' },
  { name: 'number', label: 'Número', autoComplete: 'off', type: 'text' },
  { name: 'district', label: 'Bairro', autoComplete: 'off', type: 'text' },
  { name: 'city', label: 'Cidade', autoComplete: 'address-level2', type: 'text' },
  {
    name: 'state',
    label: 'UF',
    autoComplete: 'address-level1',
    type: 'text',
    pattern: '[A-Za-z]{2}',
  },
];
const demo: Record<string, string> = {
  name: 'Cliente Demonstração',
  email: 'demo@example.com',
  postalCode: '01001-000',
  street: 'Rua de demonstração',
  number: '100',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
};

export function CheckoutForm() {
  const { items, ready, coupon, clear } = useCart();
  const [values, setValues] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState<'pix' | 'card'>('pix');
  const [gift, setGift] = useState(false);
  const [order, setOrder] = useState<{ code: string; total: number } | null>(null);
  const totals = calculateTotals(items, coupon, payment, gift);
  if (!ready)
    return (
      <p className="text-center py-24" role="status">
        Carregando sua sacola…
      </p>
    );
  if (order)
    return (
      <section className="max-w-lg mx-auto text-center py-20 space-y-6">
        <Check size={40} className="mx-auto text-stuw-sage" />
        <p className="eyebrow">Demonstração concluída</p>
        <h1 className="font-serif text-4xl">Tudo pronto para o próximo movimento.</h1>
        <p className="text-sm">
          Simulação {order.code} · {currency(order.total)}
        </p>
        <p className="text-xs text-stuw-slate">Nenhuma cobrança foi realizada ou pedido enviado.</p>
        <Link href="/produtos" className="inline-block underline text-sm">
          Voltar à coleção
        </Link>
      </section>
    );
  if (!items.length)
    return (
      <section className="text-center py-24 space-y-6">
        <h1 className="font-serif text-4xl">Sua sacola está vazia.</h1>
        <Link href="/produtos" className="underline text-sm">
          Explorar coleção
        </Link>
      </section>
    );
  return (
    <>
      <Link href="/produtos" className="inline-flex items-center gap-2 text-xs mb-8">
        <ArrowLeft size={14} /> Continuar comprando
      </Link>
      <h1 className="font-serif text-4xl mb-3">Seu próximo movimento.</h1>
      <p className="text-xs text-stuw-slate mb-10">
        Checkout de demonstração. Sem cobrança ou envio de dados.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!items.length) return;
          setOrder({
            code: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            total: totals.total,
          });
          clear();
          setValues({});
        }}
        className="grid lg:grid-cols-2 gap-12 lg:gap-24"
      >
        <div className="space-y-10">
          <section>
            <div className="flex justify-between items-center mb-6 gap-4">
              <h2 className="text-lg font-serif">Entrega</h2>
              <button type="button" onClick={() => setValues(demo)} className="text-xs underline">
                Preencher demonstração
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {fields.map((field) => (
                <label key={field.name} className="text-xs space-y-2">
                  <span>{field.label}</span>
                  <input
                    required
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    pattern={field.pattern}
                    maxLength={field.name === 'state' ? 2 : 180}
                    value={values[field.name] ?? ''}
                    onChange={(event) =>
                      setValues((values) => ({ ...values, [field.name]: event.target.value }))
                    }
                    className="field"
                  />
                </label>
              ))}
            </div>
          </section>
          <label className="flex items-center gap-3 text-xs">
            <input
              type="checkbox"
              checked={gift}
              onChange={(event) => setGift(event.target.checked)}
              className="accent-stuw-sage w-4 h-4"
            />{' '}
            Embalagem para presente · {currency(35)}
          </label>
          <fieldset>
            <legend className="font-serif text-lg mb-5">Pagamento</legend>
            <div className="grid grid-cols-2 gap-3">
              {(['pix', 'card'] as const).map((method) => (
                <label
                  key={method}
                  className={`border p-4 text-sm cursor-pointer ${payment === method ? 'border-stuw-sage bg-stuw-sage/5' : 'border-stuw-border dark:border-stuw-borderDark'}`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={method}
                    checked={payment === method}
                    onChange={() => setPayment(method)}
                    className="accent-stuw-sage mr-2"
                  />
                  {method === 'pix' ? 'PIX · 5% OFF' : 'Cartão · até 6x'}
                </label>
              ))}
            </div>
            <p className="text-xs text-stuw-slate mt-4">
              {payment === 'pix'
                ? 'O código PIX será disponibilizado quando o pagamento estiver ativo.'
                : 'O pagamento com cartão estará disponível em breve.'}
            </p>
          </fieldset>
        </div>
        <section className="bg-stuw-sand/60 dark:bg-stone-900 p-6 sm:p-8 self-start">
          <h2 className="font-serif text-2xl mb-6">Seu pedido</h2>
          <ul className="space-y-5 mb-8">
            {items.map((item) => (
              <li key={itemKey(item)} className="flex gap-4 items-center">
                <Image
                  src={item.image}
                  alt={item.title}
                  width={56}
                  height={75}
                  className="w-14 h-[75px] object-cover"
                />
                <div className="flex-1 text-xs">
                  <p>{item.title}</p>
                  <p className="text-stuw-slate mt-2">
                    {item.color} / {item.size} / {item.qty} un.
                  </p>
                </div>
                <span className="text-xs">{currency(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <OrderSummary totals={totals} />
          <Button type="submit" className="w-full mt-8 !rounded-none !py-4">
            Concluir demonstração
          </Button>
          <p className="text-[10px] text-stuw-slate text-center mt-4">
            Frete e valores ilustrativos do MVP.
          </p>
        </section>
      </form>
    </>
  );
}
