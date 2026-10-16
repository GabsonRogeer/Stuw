import { timingSafeEqual } from 'node:crypto';
import { syncOlistCatalog } from '@/lib/integrations/olist-sync';
import { getInvoiceAutomationStatus } from '@/lib/integrations/olist-invoice-automation';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') ?? '';
  if (
    !expected ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(`Bearer ${expected}`) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${expected}`))
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const direction = new URL(request.url).searchParams.get('direction') ?? 'export';
  if (
    direction !== 'export' &&
    direction !== 'import' &&
    direction !== 'orders' &&
    direction !== 'stock' &&
    direction !== 'invoices'
  )
    return Response.json({ error: 'Invalid direction' }, { status: 400 });
  try {
    if (direction === 'invoices' && new URL(request.url).searchParams.get('verify') === '1')
      return Response.json(await getInvoiceAutomationStatus());
    return Response.json(await syncOlistCatalog(direction));
  } catch {
    return Response.json({ error: 'Olist sync unavailable' }, { status: 503 });
  }
}
