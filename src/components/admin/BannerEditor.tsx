'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BANNER_BUCKET, validateBannerFile, bannerImageUrl } from '@/services/banners';
import { saveBanner, publishBanner, unpublishBanner } from '@/app/admin/banners/actions';
import { ManagedBanner } from '@/components/home/ManagedBanner/ManagedBanner';
import { Button } from '@/components/ui/button/button';
import type { Banner } from '@/types/database';
const field =
  'block w-full mt-2 border border-stuw-border dark:border-stuw-borderDark rounded-md p-3 bg-white dark:bg-stone-900 text-sm';
function localDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function useImagePreview(file: File | null, path: string) {
  const [local, setLocal] = useState('');
  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLocal(reader.result);
    };
    reader.readAsDataURL(file);
    return () => {
      reader.onload = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file]);
  return file ? local : bannerImageUrl(path);
}
export function BannerEditor({
  draft,
  published,
  onClose,
  onSaved,
}: {
  draft: Banner | null;
  published: Banner | null;
  onClose: () => void;
  onSaved: (banner: Banner) => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(draft);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [subtitle, setSubtitle] = useState(draft?.subtitle ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [link, setLink] = useState(draft?.link ?? '/produtos');
  const [layout, setLayout] = useState<Banner['layout']>(draft?.layout ?? 'split');
  const [starts, setStarts] = useState(localDate(draft?.starts_at));
  const [ends, setEnds] = useState(localDate(draft?.ends_at));
  const [desktopPositionY, setDesktopPositionY] = useState(draft?.desktop_position_y ?? 0);
  const [position, setPosition] = useState(draft?.position ?? 0);
  const [reuseImage, setReuseImage] = useState(!draft || draft.desktop_path === draft.mobile_path);
  const [desktop, setDesktop] = useState<File | null>(null);
  const [mobile, setMobile] = useState<File | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop');
  const desktopUrl = useImagePreview(desktop, saved?.desktop_path ?? '');
  const ownMobileUrl = useImagePreview(mobile, saved?.mobile_path ?? '');
  const mobileUrl = reuseImage ? desktopUrl : ownMobileUrl;
  function pick(file: File | undefined, setter: (file: File) => void) {
    if (!file) return;
    const invalid = validateBannerFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setter(file);
    setDirty(true);
    setError('');
    setMessage('');
  }
  async function upload(file: File | null, current: string) {
    if (!file) return current;
    const invalid = validateBannerFile(file);
    if (invalid) throw new Error(invalid);
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error(
        'O arquivo não pôde ser aberto como imagem. Escolha um JPG, PNG ou WebP válido.',
      );
    }
    bitmap.close();
    const extension =
      file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
    const path = 'home/' + crypto.randomUUID() + '.' + extension;
    const { error } = await createClient()
      .storage.from(BANNER_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
    if (error) throw new Error('Falha no upload. Verifique o armazenamento e tente novamente.');
    return path;
  }
  return (
    <div className="space-y-8">
      <button
        type="button"
        disabled={pending}
        className="text-sm underline"
        onClick={() => {
          if (!dirty || window.confirm('Descartar as alterações não salvas?')) onClose();
        }}
      >
        ← Voltar aos cards salvos
      </button>
      <div className="rounded-lg bg-stuw-sand dark:bg-stone-800 p-5 text-sm">
        <p className="font-medium">{published ? 'Campanha publicada' : 'Rascunho'}</p>
        {published && <p className="mt-2 break-words">{published.title}</p>}
        <p className="text-xs text-stuw-slate mt-2">
          Salvar rascunho não altera a home. Publicar adiciona este card ao carrossel no período
          definido.
        </p>
      </div>
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError('');
          setMessage('');
          try {
            const desktopPath = await upload(desktop, saved?.desktop_path ?? '');
            const mobilePath = reuseImage
              ? desktopPath
              : await upload(mobile, saved?.mobile_path ?? '');
            const form = new FormData();
            Object.entries({
              id: saved?.id ?? '',
              layout,
              starts_at: starts ? new Date(starts).toISOString() : '',
              ends_at: ends ? new Date(ends).toISOString() : '',
              position: String(position),
              desktop_position_y: String(desktopPositionY),
              title,
              subtitle,
              description,
              link,
              desktop_path: desktopPath,
              mobile_path: mobilePath,
              revision: String(saved?.revision ?? 0),
            }).forEach(([key, value]) => form.set(key, value));
            const result = await saveBanner(form);
            if (result.error) setError(result.error);
            else if (result.draft) {
              setSaved(result.draft);
              onSaved(result.draft);
              setDesktop(null);
              setMobile(null);
              setDirty(false);
              setMessage(result.message ?? '');
              router.refresh();
            }
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Não foi possível salvar.');
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="space-y-5">
          <label className="block text-sm">
            Formato do card
            <select
              className={field}
              value={layout}
              onChange={(event) => {
                setLayout(event.target.value as Banner['layout']);
                setDirty(true);
              }}
            >
              <option value="split">Foto + texto</option>
              <option value="image">Foto em toda a largura</option>
            </select>
          </label>
          <label className="block text-sm">
            {layout === 'image'
              ? 'Nome da campanha / descrição acessível da foto'
              : 'Título principal'}
            <input
              className={field}
              required
              minLength={2}
              maxLength={160}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label className={layout === 'image' ? 'hidden' : 'block text-sm'}>
            Subtítulo (verde e itálico)
            <input
              className={field}
              maxLength={160}
              value={subtitle}
              placeholder="O luxo da pausa."
              onChange={(event) => {
                setSubtitle(event.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label className={layout === 'image' ? 'hidden' : 'block text-sm'}>
            Descrição
            <textarea
              className={field}
              maxLength={300}
              rows={3}
              value={description}
              placeholder="Essenciais para o estúdio. Liberdade para todos os dias."
              onChange={(event) => {
                setDescription(event.target.value);
                setDirty(true);
              }}
            />
            <span className="block mt-2 text-xs text-stuw-slate">
              Subtítulo e descrição são opcionais.
            </span>
          </label>
          <label className="block text-sm">
            Link de destino
            <input
              className={field}
              required
              maxLength={1000}
              value={link}
              placeholder="/produtos"
              onChange={(event) => {
                setLink(event.target.value);
                setDirty(true);
              }}
            />
            <span className="text-xs text-stuw-slate mt-2 block">
              Uma página do site ou um endereço HTTPS.
            </span>
          </label>
          <div className="grid sm:grid-cols-2 gap-5">
            <label className="block text-sm">
              Início da campanha (opcional)
              <input
                type="datetime-local"
                className={field}
                value={starts}
                onChange={(event) => {
                  setStarts(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <label className="block text-sm">
              Fim da campanha (opcional)
              <input
                type="datetime-local"
                className={field}
                value={ends}
                min={starts || undefined}
                onChange={(event) => {
                  setEnds(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
          </div>
          <p className="text-xs text-stuw-slate">
            Horário local do seu navegador. Sem início, a publicação é imediata; sem fim, permanece
            no ar até ser retirada. Ao encerrar, o card continua salvo.
          </p>
          <label className="block text-sm">
            Ordem no carrossel (menores primeiro)
            <input
              type="number"
              min={0}
              max={999999}
              step={1}
              required
              className={field}
              value={position}
              onChange={(event) => {
                setPosition(Number(event.target.value));
                setDirty(true);
              }}
            />
          </label>
          <label className="flex gap-2 text-sm items-center">
            <input
              type="checkbox"
              checked={reuseImage}
              onChange={(event) => {
                setReuseImage(event.target.checked);
                setDirty(true);
              }}
            />
            Usar a mesma foto no desktop e no celular
          </label>
          <div className="grid sm:grid-cols-2 gap-5">
            <label className="block text-sm">
              Imagem desktop
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={field}
                onChange={(event) => pick(event.target.files?.[0], setDesktop)}
              />
              <span className="block mt-2 text-xs text-stuw-slate">
                Sugestão: {layout === 'image' ? '1920 × 800' : '1200 × 1400'} px. JPG, PNG ou WebP,
                até 5 MB.
              </span>
            </label>
            <label className={reuseImage ? 'hidden' : 'block text-sm'}>
              Imagem celular
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={field}
                onChange={(event) => pick(event.target.files?.[0], setMobile)}
              />
              <span className="block mt-2 text-xs text-stuw-slate">
                Sugestão: 800 × 1000 px. JPG, PNG ou WebP, até 5 MB.
              </span>
            </label>
          </div>
          <label className="block text-sm">
            Posição vertical da foto no desktop: {desktopPositionY}%
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={desktopPositionY}
              className="block w-full mt-3 accent-stuw-sage"
              onChange={(event) => {
                setDesktopPositionY(Number(event.target.value));
                setMode('desktop');
                setDirty(true);
              }}
            />
            <span className="flex justify-between text-xs text-stuw-slate mt-2">
              <span>Topo (0%)</span>
              <span>Centro (50%)</span>
              <span>Base (100%)</span>
            </span>
            <span className="block text-xs text-stuw-slate mt-2">
              A foto permanece centralizada na horizontal. Ajuste e confira o rosto na prévia
              abaixo. O recorte pode variar com a largura da tela.
            </span>
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? 'Aguarde…' : 'Salvar rascunho'}
          </Button>
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
      <section className="border-t border-stuw-border dark:border-stuw-borderDark pt-7">
        <div className="flex flex-wrap justify-between gap-4 items-center mb-5">
          <h3 className="font-serif text-2xl">Prévia</h3>
          <div className="flex gap-2">
            {(['desktop', 'mobile'] as const).map((device) => (
              <button
                type="button"
                key={device}
                aria-pressed={mode === device}
                onClick={() => setMode(device)}
                className={
                  'border rounded-md px-4 py-2 text-xs ' +
                  (mode === device ? 'bg-stuw-sand dark:bg-stone-800' : '')
                }
              >
                {device === 'desktop' ? 'Desktop' : 'Celular'}
              </button>
            ))}
          </div>
        </div>
        {desktopUrl && mobileUrl ? (
          <div className="overflow-auto rounded-lg border border-stuw-border dark:border-stuw-borderDark">
            <div className={mode === 'mobile' ? 'w-[375px] max-w-full mx-auto' : 'min-w-[800px]'}>
              <ManagedBanner
                layout={layout}
                desktopPositionY={desktopPositionY}
                title={title || 'Título do banner'}
                subtitle={subtitle}
                description={description}
                link={link}
                desktop={desktopUrl}
                mobile={mobileUrl}
                preview={mode}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-stuw-slate py-10">
            Envie a foto para visualizar o card. Confira o recorte nas duas telas.
          </p>
        )}
      </section>
      <div className="border-t border-stuw-border dark:border-stuw-borderDark pt-6 flex flex-wrap items-center gap-5">
        <Button
          disabled={pending || dirty || !saved}
          onClick={async () => {
            if (!saved) return;
            setPending(true);
            setError('');
            setMessage('');
            try {
              const result = await publishBanner(saved.id, saved.revision);
              if (result.error) setError(result.error);
              else {
                if (result.draft) {
                  setSaved(result.draft);
                  onSaved(result.draft);
                }
                setMessage(result.message ?? '');
                router.refresh();
              }
            } catch {
              setError('Não foi possível publicar.');
            } finally {
              setPending(false);
            }
          }}
        >
          Publicar rascunho
        </Button>
        {published && saved && (
          <button
            type="button"
            disabled={pending}
            className="text-sm underline disabled:opacity-50"
            onClick={async () => {
              setPending(true);
              setError('');
              setMessage('');
              try {
                const result = await unpublishBanner(saved.id, saved.revision);
                if (result.error) setError(result.error);
                else {
                  if (result.draft) {
                    setSaved(result.draft);
                    onSaved(result.draft);
                  }
                  setMessage(result.message ?? '');
                  router.refresh();
                }
              } catch {
                setError('Não foi possível retirar o banner do ar.');
              } finally {
                setPending(false);
              }
            }}
          >
            Retirar do ar
          </button>
        )}
        {dirty && <p className="text-xs text-stuw-slate">Salve as alterações antes de publicar.</p>}
        <a href="/" target="_blank" rel="noreferrer" className="text-sm underline">
          Abrir home
        </a>
      </div>
    </div>
  );
}
