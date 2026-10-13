import { getPayment, validPaymentSignature } from '@/lib/integrations/mercado-pago';
import { applyPayment } from '@/lib/integrations/checkout';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('data.id') ?? '';
    if (!validPaymentSignature(request.headers, id))
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    const text = await request.text();
    if (text.length > 20000) return Response.json({ error: 'Payload too large' }, { status: 413 });
    const body = JSON.parse(text);
    if (body.type !== 'payment' || String(body.data?.id) !== id)
      return Response.json({ error: 'Invalid notification' }, { status: 400 });
    await applyPayment(await getPayment(id));
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: 'Payment reconciliation failed' }, { status: 503 });
  }
}
