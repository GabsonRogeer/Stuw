'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BannerEditor } from './BannerEditor';
import { deleteBanner } from '@/app/admin/banners/actions';
import { bannerImageUrl } from '@/services/banners';
import type { Banner } from '@/types/database';

function dateLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília)'
    : null;
}
export function BannerManager({
  drafts,
  publications,
  now,
}: {
  drafts: Banner[];
  publications: Banner[];
  now: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Banner | null | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (editing !== undefined)
    return (
      <BannerEditor
        key={editing?.id ?? 'new'}
        draft={editing}
        published={publications.find((item) => item.id === editing?.id) ?? null}
        onSaved={setEditing}
        onClose={() => {
          setEditing(undefined);
          router.refresh();
        }}
      />
    );
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setEditing(null)}
        className="rounded-md bg-stuw-obsidian text-white px-5 py-3 text-sm"
      >
        + Novo card
      </button>
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {!drafts.length && (
        <p className="text-sm text-stuw-slate">Nenhum card salvo. Crie sua primeira campanha.</p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {drafts.map((draft) => {
          const publication = publications.find((item) => item.id === draft.id);
          const status = !publication
            ? 'Fora do ar / rascunho'
            : publication.ends_at && Date.parse(publication.ends_at) <= now
              ? 'Encerrada'
              : publication.starts_at && Date.parse(publication.starts_at) > now
                ? 'Agendada'
                : 'No ar';
          return (
            <article
              key={draft.id}
              className="rounded-lg border border-stuw-border dark:border-stuw-borderDark overflow-hidden"
            >
              {/* Stored images have immutable paths; the browser can reuse its cached thumbnail. */}
              <Image
                src={bannerImageUrl(draft.desktop_path)}
                alt=""
                width={1200}
                height={500}
                unoptimized
                className="w-full h-44 object-cover"
                loading="lazy"
              />
              <div className="p-5 space-y-3">
                <div className="flex justify-between gap-3 items-start">
                  <h3 className="font-serif text-2xl break-words">{draft.title}</h3>
                  <span className="text-xs shrink-0 rounded bg-stuw-sand dark:bg-stone-800 px-2 py-1">
                    {status}
                  </span>
                </div>
                <p className="text-sm text-stuw-slate">
                  {draft.layout === 'image' ? 'Foto em toda a largura' : 'Foto + texto'} · Ordem{' '}
                  {draft.position}
                </p>
                <p className="text-xs">
                  Período salvo: {dateLabel(draft.starts_at) ?? 'A partir da publicação'} →{' '}
                  {dateLabel(draft.ends_at) ?? 'Sem data final'}
                </p>
                {publication && publication.revision !== draft.revision && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Há alterações salvas ainda não publicadas. O período no ar continua o da última
                    publicação.
                  </p>
                )}
                <div className="flex gap-5 text-sm pt-2">
                  <button
                    type="button"
                    className="underline"
                    disabled={pending}
                    onClick={() => setEditing(draft)}
                  >
                    Editar / publicar
                  </button>
                  <button
                    type="button"
                    className="underline text-red-700 dark:text-red-300"
                    disabled={pending}
                    onClick={() => setDeleting(draft.id)}
                  >
                    Excluir
                  </button>
                </div>
                {deleting === draft.id && (
                  <div
                    className="border-t pt-4 space-y-3"
                    role="group"
                    aria-label="Confirmar exclusão"
                  >
                    <p className="text-sm">Excluir “{draft.title}” dos cards salvos e da home?</p>
                    <div className="flex gap-5 text-sm">
                      <button
                        type="button"
                        disabled={pending}
                        className="text-red-700 dark:text-red-300 underline"
                        onClick={async () => {
                          setPending(true);
                          setError('');
                          try {
                            const result = await deleteBanner(draft.id, draft.revision);
                            if (result.error) setError(result.error);
                            else {
                              setDeleting(null);
                              router.refresh();
                            }
                          } catch {
                            setError('Não foi possível excluir. Tente novamente.');
                          } finally {
                            setPending(false);
                          }
                        }}
                      >
                        {pending ? 'Excluindo…' : 'Confirmar exclusão'}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="underline"
                        onClick={() => setDeleting(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
