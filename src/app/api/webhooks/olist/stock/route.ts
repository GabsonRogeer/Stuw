import { timingSafeEqual } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const secret = process.env.OLIST_STOCK_WEBHOOK_SECRET;
  const supplied = new URL(request.url).searchParams.get('key') ?? '';
  if (
    !secret ||
    secret.length < 32 ||
    supplied.length !== secret.length ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(secret) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.OLIST_ENABLED !== 'true' && process.env.OLIST_STOCK_ENABLED !== 'true')
    return Response.json({ error: 'Disabled' }, { status: 503 });
  try {
    // Webhooks are hints only. Never apply the supplied balance or trust its arrival order.
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: 'Body required' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 16_384) {
        await reader.cancel();
        return Response.json({ error: 'Too large' }, { status: 413 });
      }
      chunks.push(part.value);
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const id = String(payload?.dados?.idProduto ?? '');
    const sku = payload?.dados?.sku;
    if (
      payload?.tipo !== 'estoque' ||
      !/^[1-9]\d{0,18}$/.test(id) ||
      typeof sku !== 'string' ||
      sku.length > 30
    )
      return Response.json({ error: 'Invalid notification' }, { status: 400 });
    const db = createServiceClient();
    const link = await db
      .from('olist_skus')
      .select('sku')
      .eq('remote_id', id)
      .eq('sku', sku)
      .eq('state', 'linked')
      .maybeSingle();
    if (link.error) throw new Error();
    if (link.data) {
      const queued = await db
        .from('olist_inventory')
        .update({ next_check_at: new Date(0).toISOString() })
        .eq('sku', sku);
      if (queued.error) throw new Error();
    }
    return Response.json({ accepted: true });
  } catch {
    return Response.json({ error: 'Notification unavailable' }, { status: 503 });
  }
}
