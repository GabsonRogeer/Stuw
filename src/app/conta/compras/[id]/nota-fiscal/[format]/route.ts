import { createClient } from '@/lib/supabase/server';
import { readInvoiceFile } from '@/lib/invoices/files';
import { isUuid } from '@/services/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; format: string }> },
) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  const { id, format } = await params;
  if (!isUuid(id) || !['pdf', 'xml'].includes(format))
    return Response.json({ error: 'Documento não encontrado.' }, { status: 404, headers });
  try {
    const db = await createClient();
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    if (error || !user)
      return Response.json(
        { error: 'Entre na sua conta para consultar a nota fiscal.' },
        { status: 401, headers },
      );
    // Ownership is checked with the customer's client and RLS before any privileged file access.
    const order = await db
      .from('orders')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (order.error) throw new Error('Order check unavailable');
    if (!order.data)
      return Response.json({ error: 'Documento não encontrado.' }, { status: 404, headers });
    const file = await readInvoiceFile(id, format as 'pdf' | 'xml');
    if (!file)
      return Response.json({ error: 'Documento não encontrado.' }, { status: 404, headers });
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        ...headers,
        'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="STUW-NFe-${file.document.number}-serie-${file.document.series}.${format}"`,
        'Content-Length': String(file.bytes.length),
      },
    });
  } catch {
    return Response.json(
      { error: 'Não foi possível consultar a nota fiscal. Tente novamente.' },
      { status: 503, headers },
    );
  }
}
