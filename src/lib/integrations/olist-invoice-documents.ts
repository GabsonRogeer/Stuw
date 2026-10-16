import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import {
  assertRemoteInvoice,
  assertRemoteInvoiceOrder,
  invoiceState,
} from '@/services/olist-invoices';
import {
  extractInvoiceXml,
  validateInvoiceXml,
  INVOICE_FILE_LIMIT,
} from '@/services/invoice-documents';
import { INVOICE_BUCKET, fileHash } from '@/lib/invoices/files';
import { renderOlistDanfe } from '@/lib/invoices/render-danfe';
import { olistRequest } from './olist';

async function fetchInvoiceXml(invoiceId: string) {
  const token = process.env.OLIST_API_TOKEN;
  if (!token || !/^[1-9]\d{0,18}$/.test(invoiceId))
    throw new Error('Consulta fiscal indisponível.');
  const response = await fetch('https://api.tiny.com.br/api2/nota.fiscal.obter.xml.php', {
    method: 'POST',
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, id: invoiceId }),
  });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > INVOICE_FILE_LIMIT)
    throw new Error('XML fiscal indisponível.');
  return extractInvoiceXml(await response.text());
}

export async function archiveOlistInvoice(orderId: string, verifyOnly = false) {
  if (process.env.MERCADO_PAGO_ENVIRONMENT !== 'production' || process.env.OLIST_ENABLED !== 'true')
    throw new Error('Documentos fiscais de produção desabilitados.');
  const db = createServiceClient();
  async function clearDocumentError() {
    const saved = await db
      .from('olist_invoice_jobs')
      .update({ document_error: null })
      .eq('order_id', orderId);
    if (saved.error)
      throw new Error('Documentos disponíveis; atualização do diagnóstico pendente.');
  }
  const existing = await db
    .from('order_invoice_documents')
    .select('order_id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing.error) throw new Error('Consulta de documentos indisponível.');
  if (existing.data && !verifyOnly) {
    await clearDocumentError();
    return { status: 'ready' as const };
  }
  const [orders, links, jobs, snapshot] = await Promise.all([
    db.from('orders').select('*').eq('id', orderId).single(),
    db.from('olist_orders').select('*').eq('order_id', orderId).single(),
    db.from('olist_invoice_jobs').select('*').eq('order_id', orderId).single(),
    db.rpc('get_olist_invoice_components', { input_order: orderId }),
  ]);
  if (
    orders.error ||
    links.error ||
    jobs.error ||
    snapshot.error ||
    !snapshot.data?.length ||
    jobs.data.status !== 'authorized' ||
    !jobs.data.invoice_id ||
    !links.data.remote_id ||
    links.data.invoice_id !== jobs.data.invoice_id
  )
    throw new Error('Vínculo fiscal autorizado indisponível.');
  const order = orders.data,
    link = links.data,
    invoiceId = jobs.data.invoice_id;
  const remote = (await olistRequest('pedido.obter.php', { id: link.remote_id! })).pedido;
  const invoice = (await olistRequest('nota.fiscal.obter.php', { id: invoiceId })).nota_fiscal;
  if (
    !remote ||
    !invoice ||
    String(remote.id_nota_fiscal) !== invoiceId ||
    invoiceState(invoice) !== 'authorized'
  )
    throw new Error('Autorização fiscal ainda não confirmada.');
  assertRemoteInvoiceOrder(order, remote, link.remote_id!, link.tax_document ?? '');
  assertRemoteInvoice(
    order,
    invoice,
    link.remote_id!,
    invoiceId,
    link.tax_document ?? '',
    snapshot.data,
  );
  const xml = await fetchInvoiceXml(invoiceId);
  const metadata = validateInvoiceXml(
    xml,
    order,
    link.remote_id!,
    invoice,
    link.tax_document ?? '',
    snapshot.data,
  );
  const view = await olistRequest('nota.fiscal.obter.link.php', { id: invoiceId });
  if (!view.link_nfe) throw new Error('DANFE indisponível na Olist.');
  const pdf = await renderOlistDanfe(view.link_nfe, metadata.accessKey);
  if (verifyOnly) return { status: 'verified' as const, pdfBytes: pdf.length };
  const xmlBytes = Buffer.from(xml, 'utf8');
  const pdfPath = `${orderId}/${invoiceId}/${fileHash(pdf)}.pdf`,
    xmlPath = `${orderId}/${invoiceId}/${fileHash(xmlBytes)}.xml`;
  for (const [path, bytes, contentType] of [
    [pdfPath, pdf, 'application/pdf'],
    [xmlPath, xmlBytes, 'application/xml'],
  ] as const) {
    const saved = await db.storage
      .from(INVOICE_BUCKET)
      .upload(path, bytes, { contentType, upsert: false, cacheControl: '0' });
    if (saved.error) {
      // A concurrent worker or interrupted upload may already have stored this exact file.
      const stored = await db.storage.from(INVOICE_BUCKET).download(path);
      if (
        stored.error ||
        !stored.data ||
        fileHash(new Uint8Array(await stored.data.arrayBuffer())) !== fileHash(bytes)
      )
        throw new Error('Arquivo fiscal não armazenado; conferir integridade antes de continuar.');
    }
  }
  const saved = await db.from('order_invoice_documents').upsert(
    {
      order_id: orderId,
      invoice_id: invoiceId,
      number: metadata.number,
      series: metadata.series,
      access_key: metadata.accessKey,
      total_cents: order.total_cents,
      authorized_at: metadata.authorizedAt,
      pdf_path: pdfPath,
      xml_path: xmlPath,
      pdf_sha256: fileHash(pdf),
      xml_sha256: fileHash(xmlBytes),
    },
    { onConflict: 'order_id', ignoreDuplicates: true },
  );
  if (saved.error) throw new Error('Documentos armazenados; vínculo com o pedido ainda pendente.');
  await clearDocumentError();
  return { status: 'ready' as const };
}

export async function prepareNextInvoiceDocuments() {
  if (
    process.env.MERCADO_PAGO_ENVIRONMENT !== 'production' ||
    process.env.OLIST_ENABLED !== 'true' ||
    process.env.TRANSACTIONAL_EMAIL_ENABLED !== 'true'
  )
    return 'disabled';
  const db = createServiceClient();
  const pending = await db
    .from('olist_invoice_jobs')
    .select('order_id,order_invoice_documents!left(order_id)')
    .eq('status', 'authorized')
    .is('order_invoice_documents', null)
    .lte('documents_next_attempt_at', new Date().toISOString())
    .order('documents_next_attempt_at')
    .limit(1);
  if (pending.error) throw new Error('Fila de documentos indisponível.');
  const task = pending.data[0];
  if (!task) return 'idle';
  try {
    await archiveOlistInvoice(task.order_id);
    return 'ready';
  } catch {
    const saved = await db
      .from('olist_invoice_jobs')
      .update({
        document_error:
          'Falha ao preparar documentos fiscais; vínculo e integridade serão conferidos novamente.',
        documents_next_attempt_at: new Date(Date.now() + 5 * 60000).toISOString(),
      })
      .eq('order_id', task.order_id);
    if (saved.error) throw new Error('Falha ao registrar pendência documental.');
    return 'pending';
  }
}
