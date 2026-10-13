'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveCategory, setCategoryArchived } from '@/app/admin/categorias/actions';
import { CATEGORY_KINDS, type Category, type CategoryKind } from '@/services/categories';

const field =
  'block w-full mt-2 border border-stuw-border dark:border-stuw-borderDark rounded p-3 bg-stuw-canvas dark:bg-stuw-obsidian text-sm';
const button =
  'border border-stuw-border dark:border-stuw-borderDark rounded px-4 py-2 text-sm disabled:opacity-50';

export function CategoryEditor({ category }: { category?: Category }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  const showForm = !category || editing;
  return (
    <div className="space-y-3">
      {showForm ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setError('');
            setMessage('');
            start(async () => {
              const result = await saveCategory(
                {
                  kind: category?.kind ?? (data.get('kind') as CategoryKind),
                  label: String(data.get('label') ?? ''),
                  position: Number(data.get('position')),
                },
                category?.id,
                category?.revision,
              );
              if (result.error) setError(result.error);
              else {
                setMessage(result.success!);
                if (!category) form.reset();
                setEditing(false);
                router.refresh();
              }
            });
          }}
        >
          <fieldset
            disabled={pending}
            className="grid sm:grid-cols-[2fr_1fr_100px] gap-4 disabled:opacity-60"
          >
            <label className="text-sm">
              Nome da categoria
              <input
                name="label"
                required
                maxLength={80}
                defaultValue={category?.label}
                className={field}
                placeholder="Ex.: Shorts"
              />
            </label>
            <label className="text-sm">
              Tipo
              <select
                name="kind"
                defaultValue={category?.kind ?? 'piece'}
                disabled={!!category}
                className={field}
              >
                {Object.entries(CATEGORY_KINDS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Ordem
              <input
                name="position"
                type="number"
                required
                min={0}
                max={999999}
                step={1}
                defaultValue={category?.position ?? 0}
                className={field}
              />
            </label>
            <div className="sm:col-span-3 flex gap-3">
              <button
                className={`${button} bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian`}
              >
                {pending ? 'Salvando…' : category ? 'Salvar alterações' : 'Adicionar categoria'}
              </button>
              {category && (
                <button type="button" className={button} onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </fieldset>
        </form>
      ) : (
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div>
            <h3 className="font-medium">{category.label}</h3>
            <p className="text-xs text-stuw-slate mt-1">
              {CATEGORY_KINDS[category.kind]} · Ordem {category.position} ·{' '}
              {category.archived ? 'Arquivada' : 'Ativa'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              className={button}
              aria-label={`Editar ${category.label}`}
              onClick={() => {
                setEditing(true);
                setConfirm(false);
                setError('');
                setMessage('');
              }}
            >
              Editar
            </button>
            <button
              type="button"
              disabled={pending}
              className={button}
              aria-label={`${category.archived ? 'Restaurar' : 'Remover'} ${category.label}`}
              onClick={() => {
                setConfirm(true);
                setError('');
                setMessage('');
              }}
            >
              {category.archived ? 'Restaurar' : 'Remover'}
            </button>
          </div>
        </div>
      )}
      {category && confirm && (
        <div className="rounded border border-stuw-border dark:border-stuw-borderDark bg-stuw-sand/40 dark:bg-stone-800 p-4 space-y-3">
          <p className="text-sm">
            {category.archived
              ? `Restaurar “${category.label}” nos menus, filtros e cadastro de produtos?`
              : `Remover “${category.label}” dos menus, filtros e novas seleções? A categoria ficará arquivada e os produtos já vinculados serão preservados.`}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={pending}
              className={button}
              onClick={() =>
                start(async () => {
                  const result = await setCategoryArchived(
                    category.id,
                    category.revision,
                    !category.archived,
                  );
                  if (result.error) setError(result.error);
                  else {
                    setMessage(result.success!);
                    setConfirm(false);
                    router.refresh();
                  }
                })
              }
            >
              {pending
                ? 'Salvando…'
                : category.archived
                  ? 'Confirmar restauração'
                  : 'Confirmar remoção'}
            </button>
            <button
              type="button"
              disabled={pending}
              className={button}
              onClick={() => setConfirm(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-stuw-slate">
          {message}
        </p>
      )}
    </div>
  );
}
