'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useWholesale } from '@/providers/wholesale-provider';
import { wholesaleKey } from '@/services/wholesale';
import { createQuote } from '@/app/actions/wholesale';
export function QuoteCheckout({
  email,
  name,
  phone,
  minimum,
}: {
  email: string;
  name: string;
  phone: string;
  minimum: number | null;
}) {
  const { items, ready, count, change, remove, clear } = useWholesale();
  const router = useRouter();
  const key = useRef<string | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);
  if (!ready) return <p role="status">Carregando sua lista…</p>;
  if (!items.length)
    return (
      <p>
        Sua lista está vazia.{' '}
        <Link className="underline" href="/atacado">
          Explorar atacado
        </Link>
      </p>
    );
  return (
    <form
      className="space-y-8"
      aria-busy={pending}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy.current) return;
        const form = new FormData(e.currentTarget);
        key.current ??= crypto.randomUUID();
        busy.current = true;
        setPending(true);
        setError('');
        try {
          const result = await createQuote({
            key: key.current,
            name: String(form.get('name') ?? ''),
            phone: String(form.get('phone') ?? ''),
            company: String(form.get('company') ?? ''),
            cnpj: String(form.get('cnpj') ?? ''),
            notes: String(form.get('notes') ?? ''),
            items: items.map(({ id, size, color, qty }) => ({ id, size, color, qty })),
          });
          if (result.id) {
            clear();
            router.push(`/conta/cotacoes/${result.id}`);
          } else {
            setError(result.error ?? 'Não foi possível registrar.');
            setLoginRequired(Boolean(result.loginRequired));
          }
        } catch {
          setError('Falha de conexão. Tente novamente.');
        } finally {
          busy.current = false;
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-8">
        <section className="border rounded-lg p-5 border-stuw-border dark:border-stuw-borderDark">
          <h2 className="font-serif text-2xl mb-4">Peças selecionadas</h2>
          <ul className="divide-y divide-stuw-border dark:divide-stuw-borderDark">
            {items.map((item) => (
              <li
                key={wholesaleKey(item)}
                className="flex flex-wrap justify-between gap-4 py-4 text-sm"
              >
                <div>
                  <p>{item.title}</p>
                  <p className="text-xs text-stuw-slate mt-1">
                    {item.color} · {item.size}
                  </p>
                  <button
                    type="button"
                    className="underline text-xs mt-2"
                    onClick={() => remove(wholesaleKey(item))}
                  >
                    Remover
                  </button>
                </div>
                <label className="text-xs">
                  Quantidade
                  <input
                    aria-label={`Quantidade de ${item.title}, ${item.color}, ${item.size}`}
                    className="field mt-1 !w-24"
                    type="number"
                    min={1}
                    max={9999}
                    required
                    value={item.qty}
                    onChange={(e) => change(wholesaleKey(item), Number(e.target.value))}
                  />
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-medium">Total: {count} peças</p>
          <p className="text-xs mt-2">
            {minimum === null
              ? 'Cotações temporariamente indisponíveis. Tente novamente mais tarde.'
              : `Quantidade mínima: ${minimum} peças no total.`}
          </p>
          <Link className="inline-block underline text-sm mt-4" href="/atacado">
            Adicionar mais peças
          </Link>
        </section>
        <section>
          <h2 className="font-serif text-2xl mb-4">Seus dados</h2>
          <p className="text-sm mb-5 break-all">Conta: {email}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm">
              Nome completo
              <input
                className="field mt-2"
                name="name"
                autoComplete="name"
                maxLength={200}
                defaultValue={name}
                required
              />
            </label>
            <label className="text-sm">
              WhatsApp com DDD
              <input
                className="field mt-2"
                name="phone"
                type="tel"
                autoComplete="tel-national"
                maxLength={16}
                defaultValue={phone}
                required
              />
            </label>
            <label className="text-sm">
              Empresa (opcional)
              <input
                className="field mt-2"
                name="company"
                autoComplete="organization"
                maxLength={200}
              />
            </label>
            <label className="text-sm">
              CNPJ (opcional)
              <input
                className="field mt-2"
                name="cnpj"
                autoCapitalize="characters"
                maxLength={18}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Observações (opcional)
              <textarea
                className="field mt-2 !h-28"
                name="notes"
                maxLength={2000}
                placeholder="Conte o que precisa para sua empresa."
              />
            </label>
          </div>
        </section>
        <p className="text-sm text-stuw-slate">
          Esta solicitação não confirma estoque, preço ou compra. Após registrar, você poderá enviar
          o resumo pelo WhatsApp para negociar com a STUW.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        {loginRequired && (
          <Link href="/login?next=atacado" target="_blank" className="underline text-sm">
            Entrar novamente em outra aba
          </Link>
        )}
        <button
          disabled={pending || minimum === null || count < (minimum ?? 1)}
          className="rounded-md px-6 py-4 bg-stuw-obsidian text-white dark:bg-stuw-canvas dark:text-stuw-obsidian disabled:opacity-50"
        >
          {pending ? 'Registrando…' : 'Registrar cotação'}
        </button>
      </fieldset>
    </form>
  );
}
