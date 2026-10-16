import { timingSafeEqual } from 'node:crypto';
import { processEmailOutbox } from '@/lib/email/outbox';
import {
  archiveOlistInvoice,
  prepareNextInvoiceDocuments,
} from '@/lib/integrations/olist-invoice-documents';
import { isUuid } from '@/services/orders';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') ?? '';
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(`Bearer ${secret}`) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${secret}`))
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const verify = new URL(request.url).searchParams.get('verifyInvoice');
    if (verify !== null) {
      if (!isUuid(verify))
        return Response.json({ error: 'Invalid invoice order' }, { status: 400 });
      // Operational read-only check: no file writes, queue insertion or SMTP send.
      return Response.json(await archiveOlistInvoice(verify, true));
    }
    let documents = 'unavailable';
    try {
      documents = await prepareNextInvoiceDocuments();
    } catch {
      /* Purchase confirmations still run if document preparation is unavailable. */
    }
    return Response.json({ ...(await processEmailOutbox()), documents });
  } catch (error) {
    const code =
      error instanceof Error && /^PDF_(BROWSER|RENDER)_FAILED$/.test(error.message)
        ? error.message
        : 'UNAVAILABLE';
    return Response.json({ error: 'Email service unavailable', code }, { status: 503 });
  }
}
