import { timingSafeEqual } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { syncOrderPayment, syncOrderShipment } from '@/lib/integrations/checkout';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') ?? '';
  if (
    !expected ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(`Bearer ${expected}`) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${expected}`))
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const db = createServiceClient();
  const { data, error } = await db
    .from('order_integrations')
    .select('*')
    .lt('next_sync_at', new Date().toISOString())
    .order('next_sync_at')
    .limit(10);
  if (error) return Response.json({ error: 'Unavailable' }, { status: 503 });
  const results = await Promise.allSettled(
    data.map(async (row) => {
      const claimed = await db
        .from('order_integrations')
        .update({
          last_synced_at: new Date().toISOString(),
          next_sync_at: new Date(Date.now() + 120000).toISOString(),
        })
        .eq('order_id', row.order_id)
        .eq('next_sync_at', row.next_sync_at!)
        .select('order_id')
        .maybeSingle();
      if (!claimed.data) return;
      try {
        await syncOrderPayment(row.order_id);
        if (row.label_id) await syncOrderShipment(row.order_id, row.label_id);
      } catch {
        await db
          .from('order_integrations')
          .update({ sync_error: 'Falha na sincronização. Verifique a integração.' })
          .eq('order_id', row.order_id);
        throw new Error('Sync failed');
      }
    }),
  );
  return Response.json({
    processed: results.length,
    failed: results.filter((r) => r.status === 'rejected').length,
  });
}
