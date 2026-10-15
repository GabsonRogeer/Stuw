import { timingSafeEqual } from 'node:crypto';
import { processEmailOutbox } from '@/lib/email/outbox';
export const runtime = 'nodejs';
export const maxDuration = 60;
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
    return Response.json(await processEmailOutbox());
  } catch {
    return Response.json({ error: 'Email service unavailable' }, { status: 503 });
  }
}
