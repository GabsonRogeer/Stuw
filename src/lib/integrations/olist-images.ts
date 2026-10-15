import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

export function allowedOlistImage(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname === 's3.amazonaws.com' &&
      url.pathname.startsWith('/tiny-anexos-us/erp/')
    );
  } catch {
    return false;
  }
}

export async function copyOlistImage(url: string) {
  // Restrict downloads to the provider's observed image bucket; never fetch arbitrary ERP URLs.
  if (!allowedOlistImage(url))
    throw new Error('Domínio de imagem não homologado. Envie a imagem pelo painel do site.');
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  if (!response.ok || !response.body) throw new Error('Imagem indisponível.');
  const parts: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 5 * 1024 * 1024) {
      await reader.cancel();
      throw new Error('Imagem maior que 5 MB.');
    }
    parts.push(part.value);
  }
  const bytes = Buffer.concat(parts);
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!jpg && !png && !webp) throw new Error('Formato de imagem não permitido.');
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  const name = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}.${jpg ? 'jpg' : png ? 'png' : 'webp'}`;
  const storage = createServiceClient().storage.from('product-images');
  const { error } = await storage.upload(name, bytes, {
    contentType: jpg ? 'image/jpeg' : png ? 'image/png' : 'image/webp',
    upsert: false,
  });
  if (error && !['409', 'Duplicate'].includes(String(error.statusCode))) {
    const existing = await storage.info(name);
    if (existing.error) throw new Error('Não foi possível guardar a imagem.');
  }
  return `/api/product-images/${name}`;
}
