export const BANNER_BUCKET = 'site-banners';
export const BANNER_MAX_BYTES = 5 * 1024 * 1024;
export type BannerContent = {
  title: string;
  subtitle?: string;
  description?: string;
  link: string;
  desktop_path: string;
  mobile_path: string;
  layout?: 'split' | 'image';
  starts_at?: string | null;
  ends_at?: string | null;
  position?: number;
  desktop_position_y?: number;
};
export const bannerPathValid = (path: string) => /^home\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path);
export function bannerLinkValid(link: string) {
  if (!link || link.length > 1000 || /[\\\s\u0000-\u001f]/.test(link)) return false;
  if (link.startsWith('/') && !link.startsWith('//')) {
    // Block encoded slashes/backslashes that could become a protocol-relative URL.
    try {
      return !decodeURIComponent(link).startsWith('//') && !decodeURIComponent(link).includes('\\');
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(link);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function validateBanner(value: BannerContent) {
  if (
    value.desktop_position_y !== undefined &&
    (!Number.isInteger(value.desktop_position_y) ||
      value.desktop_position_y < 0 ||
      value.desktop_position_y > 100)
  )
    return 'A posição vertical deve ser um número inteiro entre 0 e 100.';
  if (value.layout !== undefined && !['split', 'image'].includes(value.layout))
    return 'Selecione imagem inteira ou imagem com texto.';
  if (
    value.position !== undefined &&
    (!Number.isInteger(value.position) || value.position < 0 || value.position > 999999)
  )
    return 'A ordem deve ser um número inteiro entre 0 e 999999.';
  for (const date of [value.starts_at, value.ends_at]) {
    if (
      date !== undefined &&
      date !== null &&
      (!/^\d{4}-\d\d-\d\dT/.test(date) || !Number.isFinite(Date.parse(date)))
    )
      return 'Informe uma data válida para a campanha.';
  }
  if (value.starts_at && value.ends_at && Date.parse(value.ends_at) <= Date.parse(value.starts_at))
    return 'O fim da campanha deve ser posterior ao início.';
  if (value.title.trim().length < 2 || value.title.trim().length > 160)
    return 'Informe um título entre 2 e 160 caracteres.';
  if (
    value.subtitle !== undefined &&
    (typeof value.subtitle !== 'string' || value.subtitle.trim().length > 160)
  )
    return 'O subtítulo deve ter até 160 caracteres.';
  if (
    value.description !== undefined &&
    (typeof value.description !== 'string' || value.description.trim().length > 300)
  )
    return 'A descrição deve ter até 300 caracteres.';
  if (!bannerLinkValid(value.link))
    return 'Use um caminho do site (ex.: /produtos) ou um endereço HTTPS válido.';
  if (!bannerPathValid(value.desktop_path) || !bannerPathValid(value.mobile_path))
    return 'Envie as imagens para desktop e celular.';
  return null;
}
export function bannerIsCurrent(banner: Pick<BannerContent, 'starts_at' | 'ends_at'>, now: number) {
  return (
    (!banner.starts_at || Date.parse(banner.starts_at) <= now) &&
    (!banner.ends_at || Date.parse(banner.ends_at) > now)
  );
}
export function validateBannerFile(file: { size: number; type: string }) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return 'Use imagens JPG, PNG ou WebP.';
  if (file.size <= 0 || file.size > BANNER_MAX_BYTES) return 'Cada imagem deve ter no máximo 5 MB.';
  return null;
}
export function bannerImageUrl(path: string) {
  if (!bannerPathValid(path)) return '';
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  return base ? base + '/storage/v1/object/public/' + BANNER_BUCKET + '/' + path : '';
}
