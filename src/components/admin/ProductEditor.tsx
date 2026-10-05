'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button/button';
import { saveProduct, archiveProduct } from '@/app/admin/produtos/actions';
import { createClient } from '@/lib/supabase/client';
import {
  PRODUCT_SECTIONS,
  PRODUCT_SIZES,
  PRODUCT_BUCKET,
  MAX_PRODUCT_IMAGE,
  IMAGE_TYPES,
  slugify,
  validateProduct,
  type ProductDraft,
  type AdminProduct,
  type AdminColor,
} from '@/services/product-admin';

const field =
  'block w-full mt-2 border border-stuw-border dark:border-stuw-borderDark rounded-md px-3 py-2.5 bg-white dark:bg-stone-900 text-sm';
const smallButton =
  'inline-flex items-center gap-2 text-xs border border-stuw-border dark:border-stuw-borderDark rounded px-3 py-2 disabled:opacity-40';
const localDate = (s: string) =>
  s
    ? new Date(Date.parse(s) - new Date(s).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';
export function ProductEditor({
  initial,
  record,
  legacyId,
  legacyImages = [],
}: {
  initial: ProductDraft;
  record?: AdminProduct;
  legacyId?: number;
  legacyImages?: AdminColor['images'];
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(record);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const router = useRouter();
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const color = (index: number, update: Partial<AdminColor>) =>
    setDraft((d) => ({
      ...d,
      colors: d.colors.map((c, i) => (i === index ? { ...c, ...update } : c)),
    }));
  async function upload(file: File | undefined, index: number) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_PRODUCT_IMAGE || file.size === 0) {
      setError('Use JPG, PNG, WebP ou AVIF com até 5 MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const extension = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/avif': 'avif',
      }[file.type];
      const path = `${crypto.randomUUID()}.${extension}`;
      const { error } = await createClient()
        .storage.from(PRODUCT_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setDraft((d) => ({
        ...d,
        colors: d.colors.map((c, i) =>
          i === index
            ? {
                ...c,
                images: [
                  ...c.images,
                  {
                    src: `/api/product-images/${path}`,
                    alt: `${d.name} — ${c.name}`,
                    role: c.images.length ? 'detalhe' : 'frente',
                  },
                ],
              }
            : c,
        ),
      }));
    } catch {
      setError(
        'Não foi possível enviar a imagem. Verifique sua conexão e a configuração do armazenamento.',
      );
    } finally {
      setUploading(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        const invalid = validateProduct(draft);
        if (invalid) {
          setError(invalid);
          return;
        }
        start(async () => {
          const result = await saveProduct({
            id: saved?.id ?? legacyId ?? null,
            revision: saved?.revision ?? 0,
            document: draft,
          });
          if (result.error) setError(result.error);
          if (result.record) {
            setSaved(result.record);
            setMessage(
              draft.status === 'draft'
                ? 'Rascunho salvo. A versão publicada foi preservada.'
                : draft.status === 'active'
                  ? 'Produto salvo. Publicação atualizada conforme o agendamento.'
                  : 'Produto retirado da vitrine.',
            );
            router.replace(`/admin/produtos/${result.record.id}`);
            router.refresh();
          }
        });
      }}
      className="space-y-5"
    >
      <fieldset disabled={pending || uploading} className="space-y-5 disabled:opacity-70">
        {PRODUCT_SECTIONS.map((section, index) => (
          <details
            key={section.title}
            open={index === 0}
            className="border border-stuw-border dark:border-stuw-borderDark rounded-lg p-5"
          >
            <summary className="cursor-pointer font-medium">{section.title}</summary>
            <div className="grid sm:grid-cols-2 gap-5 mt-5">
              {section.fields.map((f) => (
                <label
                  key={f.key}
                  className={`text-sm ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}
                >
                  {f.label}
                  {f.required ? ' *' : ''}
                  {f.options ? (
                    <select
                      className={field}
                      value={String(draft[f.key] ?? '')}
                      onChange={(e) => set(f.key, e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {f.options.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      className={field}
                      rows={4}
                      maxLength={f.max ?? 10000}
                      value={String(draft[f.key] ?? '')}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className={field}
                      type={f.type ?? 'text'}
                      required={f.required}
                      min={f.type === 'number' ? 0 : undefined}
                      step={f.key === 'wholesaleMinimum' ? 1 : '0.01'}
                      maxLength={f.max ?? 1000}
                      value={
                        f.type === 'datetime-local'
                          ? localDate(String(draft[f.key]))
                          : String(draft[f.key] ?? '')
                      }
                      onChange={(e) =>
                        set(
                          f.key,
                          f.type === 'number'
                            ? e.target.value === ''
                              ? null
                              : Number(e.target.value)
                            : f.type === 'datetime-local'
                              ? e.target.value
                                ? new Date(e.target.value).toISOString()
                                : ''
                              : e.target.value,
                        )
                      }
                      onBlur={() => {
                        if (f.key === 'name' && !draft.slug) set('slug', slugify(draft.name));
                      }}
                    />
                  )}
                  {f.hint && <span className="block mt-2 text-xs text-stuw-slate">{f.hint}</span>}
                </label>
              ))}
            </div>
          </details>
        ))}

        <details
          open
          className="border border-stuw-border dark:border-stuw-borderDark rounded-lg p-5"
        >
          <summary className="cursor-pointer font-medium">Cores, tamanhos, SKUs e imagens</summary>
          <p className="text-sm text-stuw-slate mt-4">
            A primeira cor ativa é a padrão. Preço em branco herda o valor da cor ou do produto.
            Estoque zero deixa o SKU indisponível.
          </p>
          <fieldset className="mt-5">
            <legend className="text-sm mb-3">Grade de tamanhos</legend>
            <div className="flex flex-wrap gap-4">
              {PRODUCT_SIZES.map((s) => (
                <label key={s} className="text-sm flex gap-2">
                  <input
                    type="checkbox"
                    checked={draft.sizes.includes(s)}
                    onChange={(e) => {
                      const sizes = e.target.checked
                        ? PRODUCT_SIZES.filter((v) => v === s || draft.sizes.includes(v))
                        : draft.sizes.filter((v) => v !== s);
                      setDraft((d) => ({
                        ...d,
                        sizes,
                        colors: d.colors.map((c) => ({
                          ...c,
                          skus: c.skus.filter((k) => sizes.includes(k.size)),
                        })),
                      }));
                    }}
                  />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-5 mt-6">
            {draft.colors.map((c, i) => (
              <section
                key={i}
                aria-label={`Cor ${i + 1}`}
                className="bg-stuw-sand/40 dark:bg-stone-800/40 rounded-lg p-4 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-medium">
                    {i + 1}. {c.name || 'Nova cor'}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={smallButton}
                      disabled={i === 0}
                      onClick={() => {
                        const colors = [...draft.colors];
                        [colors[i - 1], colors[i]] = [colors[i], colors[i - 1]];
                        set('colors', colors);
                      }}
                    >
                      <ArrowUp size={14} />
                      Mover acima
                    </button>
                    <button
                      type="button"
                      className={smallButton}
                      onClick={() =>
                        set(
                          'colors',
                          draft.colors.filter((_, j) => i !== j),
                        )
                      }
                    >
                      <Trash2 size={14} />
                      Remover cor
                    </button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <label className="text-sm">
                    Nome
                    <input
                      className={field}
                      value={c.name}
                      maxLength={80}
                      onChange={(e) => color(i, { name: e.target.value })}
                      onBlur={() => {
                        if (!c.slug) color(i, { slug: slugify(c.name) });
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    Slug da cor
                    <input
                      className={field}
                      value={c.slug}
                      maxLength={80}
                      onChange={(e) => color(i, { slug: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    Cor hexadecimal
                    <input
                      className={field}
                      value={c.hex}
                      placeholder="#8B6B55"
                      onChange={(e) => color(i, { hex: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    Imagem da amostra (opcional)
                    <input
                      className={field}
                      value={c.swatch}
                      placeholder="/products/.../amostra.webp"
                      onChange={(e) => color(i, { swatch: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    Preço da cor (R$)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={field}
                      value={c.price ?? ''}
                      onChange={(e) =>
                        color(i, { price: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.active}
                      onChange={(e) => color(i, { active: e.target.checked })}
                    />
                    Cor ativa
                  </label>
                </div>
                <button
                  type="button"
                  className={smallButton}
                  disabled={!draft.sizes.length}
                  onClick={() =>
                    color(i, {
                      skus: draft.sizes.map(
                        (size) =>
                          c.skus.find((s) => s.size === size) ?? {
                            size,
                            code: `STUW-${saved?.id ?? legacyId ?? draft.slug.slice(0, 20)}-${c.slug.slice(0, 15)}-${slugify(size)}`.toUpperCase(),
                            gtin: '',
                            stock: 0,
                            price: null,
                            active: true,
                          },
                      ),
                    })
                  }
                >
                  Gerar SKUs da grade
                </button>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <caption className="sr-only">SKUs da cor {c.name}</caption>
                    <thead>
                      <tr>
                        {['Tamanho', 'SKU', 'EAN/GTIN', 'Estoque', 'Preço (R$)', 'Ativo'].map(
                          (t) => (
                            <th className="p-2 font-medium" key={t}>
                              {t}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {c.skus.map((s, j) => (
                        <tr key={s.size}>
                          <th className="p-2">{s.size}</th>
                          {(['code', 'gtin', 'stock', 'price'] as const).map((k) => (
                            <td key={k} className="p-1">
                              <input
                                aria-label={`${k} ${c.name} ${s.size}`}
                                className={`${field} min-w-24`}
                                type={['stock', 'price'].includes(k) ? 'number' : 'text'}
                                min={0}
                                step={k === 'price' ? '0.01' : 1}
                                value={s[k] ?? ''}
                                onChange={(e) =>
                                  color(i, {
                                    skus: c.skus.map((sku, n) =>
                                      n === j
                                        ? {
                                            ...sku,
                                            [k]:
                                              k === 'stock'
                                                ? Number(e.target.value)
                                                : k === 'price'
                                                  ? e.target.value === ''
                                                    ? null
                                                    : Number(e.target.value)
                                                  : e.target.value,
                                          }
                                        : sku,
                                    ),
                                  })
                                }
                              />
                            </td>
                          ))}
                          <td className="p-2">
                            <input
                              aria-label={`Ativar SKU ${s.size}`}
                              type="checkbox"
                              checked={s.active}
                              onChange={(e) =>
                                color(i, {
                                  skus: c.skus.map((sku, n) =>
                                    n === j ? { ...sku, active: e.target.checked } : sku,
                                  ),
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-stuw-border dark:border-stuw-borderDark pt-4 space-y-4">
                  <h4 className="text-sm font-medium">Imagens desta cor</h4>
                  {c.images.map((m, j) => (
                    <div
                      key={j}
                      className="grid sm:grid-cols-2 gap-3 border border-stuw-border dark:border-stuw-borderDark rounded p-3"
                    >
                      <label className="text-xs">
                        Arquivo
                        <input
                          className={field}
                          value={m.src}
                          placeholder="/products/modelo/frente.webp"
                          onChange={(e) =>
                            color(i, {
                              images: c.images.map((img, n) =>
                                n === j ? { ...img, src: e.target.value } : img,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="text-xs">
                        Texto alternativo
                        <input
                          className={field}
                          maxLength={200}
                          value={m.alt}
                          onChange={(e) =>
                            color(i, {
                              images: c.images.map((img, n) =>
                                n === j ? { ...img, alt: e.target.value } : img,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="text-xs">
                        Papel
                        <select
                          className={field}
                          value={m.role}
                          onChange={(e) =>
                            color(i, {
                              images: c.images.map((img, n) =>
                                n === j ? { ...img, role: e.target.value as typeof m.role } : img,
                              ),
                            })
                          }
                        >
                          {['frente', 'costas', 'detalhe', 'lifestyle'].map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          className={smallButton}
                          disabled={j === 0}
                          onClick={() => {
                            const images = [...c.images];
                            [images[j - 1], images[j]] = [images[j], images[j - 1]];
                            color(i, { images });
                          }}
                        >
                          Mover acima
                        </button>
                        <button
                          type="button"
                          className={smallButton}
                          onClick={() => color(i, { images: c.images.filter((_, n) => n !== j) })}
                        >
                          Remover imagem
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-3 items-center">
                    <button
                      type="button"
                      className={smallButton}
                      onClick={() =>
                        color(i, {
                          images: [
                            ...c.images,
                            { src: '', alt: '', role: c.images.length ? 'detalhe' : 'frente' },
                          ],
                        })
                      }
                    >
                      Usar imagem existente
                    </button>
                    <label className="text-xs">
                      Enviar JPG, PNG, WebP ou AVIF (até 5 MB)
                      <input
                        type="file"
                        accept={IMAGE_TYPES.join(',')}
                        className="block mt-2 text-xs"
                        onChange={(e) => {
                          void upload(e.target.files?.[0], i);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              </section>
            ))}
          </div>
          <button
            type="button"
            className={`${smallButton} mt-5`}
            onClick={() =>
              set('colors', [
                ...draft.colors,
                {
                  name: '',
                  slug: '',
                  hex: '#000000',
                  swatch: '',
                  active: true,
                  price: null,
                  images: draft.colors.length === 0 ? legacyImages : [],
                  skus: [],
                },
              ])
            }
          >
            <Plus size={16} />
            Adicionar cor
          </button>
        </details>
        <section className="border border-stuw-border dark:border-stuw-borderDark rounded-lg p-5">
          <h3 className="font-medium">Publicação</h3>
          <div className="grid sm:grid-cols-2 gap-5 mt-5">
            <label className="text-sm">
              Status
              <select
                className={field}
                value={draft.status}
                onChange={(e) => set('status', e.target.value as ProductDraft['status'])}
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
            <label className="text-sm">
              Publicar a partir de
              <input
                className={field}
                type="datetime-local"
                value={localDate(draft.publishAt)}
                onChange={(e) =>
                  set('publishAt', e.target.value ? new Date(e.target.value).toISOString() : '')
                }
              />
              <span className="text-xs text-stuw-slate">
                Horário local do seu navegador. Em branco: imediato.
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => set('featured', e.target.checked)}
              />
              Destaque na home
            </label>
          </div>
          <p className="text-xs text-stuw-slate mt-4">
            Salvar como rascunho preserva a versão publicada. Ativo publica o cadastro completo;
            inativo retira o produto da vitrine.
          </p>
        </section>
        {saved && (
          <details className="text-xs text-stuw-slate">
            <summary className="cursor-pointer">Auditoria e integração</summary>
            <p className="mt-3">
              ID {saved.id} · Revisão {saved.revision}
            </p>
            <p>
              Criado em {new Date(saved.created_at).toLocaleString('pt-BR')} por {saved.created_by}
            </p>
            <p>
              Alterado em {new Date(saved.updated_at).toLocaleString('pt-BR')} por{' '}
              {saved.updated_by}
            </p>
            <p>Última sincronização: {draft.lastSync || 'Nenhuma'}</p>
          </details>
        )}
      </fieldset>
      {uploading && (
        <p role="status" className="text-sm">
          Enviando imagem…
        </p>
      )}
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
      <div className="sticky bottom-0 bg-stuw-canvas dark:bg-stuw-obsidian border-t border-stuw-border dark:border-stuw-borderDark py-4 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending || uploading}>
          {pending ? 'Salvando…' : 'Salvar produto'}
        </Button>
        <Link href="/admin/produtos" className="text-sm underline">
          Voltar à lista
        </Link>
        {saved && (
          <button
            type="button"
            disabled={pending || uploading}
            className="text-sm text-red-700 dark:text-red-300 ml-auto"
            onClick={() => setConfirmArchive(true)}
          >
            Arquivar produto
          </button>
        )}
      </div>
      {confirmArchive && saved && (
        <div role="alert" className="border border-red-300 p-4 rounded space-y-4">
          <p className="text-sm">Arquivar remove o produto da vitrine e preserva o histórico.</p>
          <button
            type="button"
            className={smallButton}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await archiveProduct(saved.id, saved.revision);
                if (result.error) setError(result.error);
                else {
                  router.push('/admin/produtos');
                  router.refresh();
                }
              })
            }
          >
            Confirmar arquivamento
          </button>{' '}
          <button type="button" className={smallButton} onClick={() => setConfirmArchive(false)}>
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}
