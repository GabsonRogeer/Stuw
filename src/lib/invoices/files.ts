import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { INVOICE_FILE_LIMIT } from '@/services/invoice-documents';

export const INVOICE_BUCKET = 'order-invoices';
export const fileHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export async function readInvoiceFile(orderId: string, format: 'pdf' | 'xml') {
  const db = createServiceClient();
  const result = await db
    .from('order_invoice_documents')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  if (result.error) throw new Error('Documento fiscal indisponível.');
  if (!result.data) return null;
  const document = result.data;
  const path = format === 'pdf' ? document.pdf_path : document.xml_path;
  const expected = format === 'pdf' ? document.pdf_sha256 : document.xml_sha256;
  const download = await db.storage.from(INVOICE_BUCKET).download(path);
  if (download.error || !download.data || download.data.size > INVOICE_FILE_LIMIT)
    throw new Error('Arquivo fiscal indisponível.');
  const bytes = Buffer.from(await download.data.arrayBuffer());
  if (
    fileHash(bytes) !== expected ||
    (format === 'pdf' && bytes.subarray(0, 5).toString() !== '%PDF-')
  )
    throw new Error('Integridade do arquivo fiscal não confirmada.');
  return { bytes, document };
}
