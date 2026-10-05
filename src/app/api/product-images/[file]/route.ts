import { getSupabaseConfig } from '@/lib/supabase/config';

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(file))
    return new Response(null, { status: 404 });
  const { url } = getSupabaseConfig();
  const response = await fetch(`${url}/storage/v1/object/public/product-images/${file}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return new Response(null, { status: response.status === 404 ? 404 : 502 });
  const type = response.headers.get('content-type') ?? '';
  if (!/^image\/(jpeg|png|webp|avif)$/.test(type)) return new Response(null, { status: 415 });
  return new Response(response.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
