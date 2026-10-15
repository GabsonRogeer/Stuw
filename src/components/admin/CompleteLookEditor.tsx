'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/types';
import {
  completeLookProducts,
  completeLookProduct,
  completeLookImages,
  type CompleteLookSettings,
} from '@/services/complete-look';
import { saveCompleteLook } from '@/app/admin/look-completo/actions';
import { CompleteLookSection } from '@/components/home/CompleteLookSection/CompleteLookSection';

const fields = [
  ['eyebrow', 'Chamada da seção', 60],
  ['title', 'Título', 80],
  ['accent', 'Título em destaque', 80],
  ['description', 'Descrição', 300],
  ['button_label', 'Texto do botão', 40],
] as const;
const inputClass =
  'block w-full mt-2 rounded-md border border-stuw-border dark:border-stuw-borderDark bg-white dark:bg-stone-900 p-3 text-sm';

export function CompleteLookEditor({
  initial,
  products,
}: {
  initial: CompleteLookSettings;
  products: Product[];
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const sets = completeLookProducts(products);
  const product = completeLookProduct(products, settings);
  const images = product ? completeLookImages(product) : [];
  function change(patch: Partial<CompleteLookSettings>) {
    setSettings((value) => ({ ...value, ...patch }));
    setMessage('');
    setError('');
  }
  return (
    <div className="space-y-8">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError('');
          setMessage('');
          try {
            const form = new FormData();
            Object.entries(settings).forEach(([key, value]) =>
              form.set(key, value === null ? '' : String(value)),
            );
            const result = await saveCompleteLook(form);
            if (result.error) setError(result.error);
            else if (result.settings) {
              setSettings(result.settings);
              setMessage('Alterações publicadas na home.');
              router.refresh();
            }
          } catch {
            setError('Não foi possível salvar. Tente novamente.');
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="space-y-5">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => change({ enabled: event.target.checked })}
            />
            Exibir seção na home
          </label>
          <label className="block text-sm">
            Conjunto em destaque
            <select
              className={inputClass}
              value={settings.product_id ?? ''}
              onChange={(event) =>
                change({
                  product_id: event.target.value ? Number(event.target.value) : null,
                  image: '',
                })
              }
            >
              <option value="">
                Automático — conjunto marcado como destaque ou primeiro do catálogo
              </option>
              {settings.product_id !== null &&
                !sets.some((item) => item.id === settings.product_id) && (
                  <option value={settings.product_id}>
                    Conjunto não disponível — selecione outro
                  </option>
                )}
              {sets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-stuw-slate">
            Nome, preço e link acompanham o catálogo. Se o conjunto escolhido sair do catálogo, a
            seção será ocultada até você selecionar outro.
          </p>
          <label className="block text-sm">
            Foto do conjunto
            <select
              className={inputClass}
              value={settings.image}
              disabled={settings.product_id === null}
              onChange={(event) => change({ image: event.target.value })}
            >
              <option value="">Foto principal (acompanha o cadastro)</option>
              {settings.image && !images.includes(settings.image) && (
                <option value={settings.image}>Foto removida — selecione outra</option>
              )}
              {images.map((image, index) => (
                <option key={image} value={image}>
                  Foto {index + 1} da galeria
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-stuw-slate">
            Para usar uma nova imagem, adicione-a à galeria do produto. No modo automático, a foto
            acompanha o conjunto selecionado.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {fields.map(([key, label, max]) => (
              <label
                key={key}
                className={'block text-sm ' + (key === 'description' ? 'sm:col-span-2' : '')}
              >
                {label}
                {key === 'description' ? (
                  <textarea
                    required
                    maxLength={max}
                    rows={3}
                    className={inputClass}
                    value={settings[key]}
                    onChange={(event) => change({ [key]: event.target.value })}
                  />
                ) : (
                  <input
                    required
                    maxLength={max}
                    className={inputClass}
                    value={settings[key]}
                    onChange={(event) => change({ [key]: event.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
          <p className="text-xs text-stuw-slate">
            A prévia abaixo muda enquanto você edita. Salvar publica as alterações imediatamente.
          </p>
          <button
            type="submit"
            className="rounded-md bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian px-6 py-3 text-sm disabled:opacity-50"
          >
            {pending ? 'Salvando…' : 'Salvar e publicar'}
          </button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <div className="border-t border-stuw-border dark:border-stuw-borderDark pt-6">
        <h3 className="font-serif text-2xl mb-5">Prévia</h3>
        {!settings.enabled ? (
          <p className="text-sm text-stuw-slate">A seção ficará oculta.</p>
        ) : !product ? (
          <p className="text-sm text-stuw-slate">
            Selecione um conjunto disponível para visualizar.
          </p>
        ) : (
          <CompleteLookSection products={products} settings={settings} />
        )}
      </div>
    </div>
  );
}
