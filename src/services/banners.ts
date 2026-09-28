export const BANNER_BUCKET = 'site-banners';
export const BANNER_MAX_BYTES = 5 * 1024 * 1024;
export type BannerContent = {
  title: string;
  subtitle?: string;
  description?: string;
  link: string;
  desktop_path: string;
  mobile_path: string;
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
