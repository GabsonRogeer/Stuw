import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import {
  assertInvoiceOrder,
  assertRemoteInvoiceOrder,
  assertRemoteInvoice,
  invoiceState,
} from '@/services/olist-invoices';
import { olistRequest, OlistError } from './olist';

export async function processOlistInvoice(
  orderId: string,
  actorId: string | null,
  operation: 'generate' | 'emit' | 'refresh',
) {
  if (
    process.env.MERCADO_PAGO_ENVIRONMENT !== 'production' ||
    process.env.OLIST_ENABLED !== 'true' ||
    process.env.OLIST_INVOICE_ENABLED !== 'true'
  )
    throw new Error('Faturamento de produção ainda não está habilitado.');
  const db = createServiceClient();
  const [orderResult, linkResult] = await Promise.all([
    db.from('orders').select('*').eq('id', orderId).single(),
    db.from('olist_orders').select('*').eq('order_id', orderId).single(),
  ]);
  if (
    orderResult.error ||
    linkResult.error ||
    !linkResult.data?.remote_id ||
    linkResult.data.state !== 'linked'
  )
    throw new Error('Pedido ainda não está vinculado à Olist.');
  const order = orderResult.data;
  const link = linkResult.data;
  const remoteId = link.remote_id!;
  assertInvoiceOrder(order);
  const snapshot = await db.rpc('get_olist_invoice_components', { input_order: orderId });
  if (snapshot.error || !snapshot.data?.length)
    throw new Error('Reserva original dos componentes indisponível para conferência fiscal.');
  async function checkRefunds() {
    const refunds = await db
      .from('order_refunds')
      .select('id', { head: true, count: 'exact' })
      .eq('order_id', orderId);
    if (refunds.error || refunds.count !== 0)
      throw new Error(
        'Pedido com reembolso ou conciliação financeira indisponível. Revise antes de faturar.',
      );
  }
  if (operation !== 'refresh') await checkRefunds();
  const ledger = await db
    .from('olist_invoice_jobs')
    .upsert({ order_id: orderId }, { onConflict: 'order_id', ignoreDuplicates: true });
  if (ledger.error) throw new Error('Não foi possível registrar o faturamento.');
  try {
    const taskResult = await db
      .from('olist_invoice_jobs')
      .select('*')
      .eq('order_id', orderId)
      .single();
    if (taskResult.error)
      throw new Error('Não foi possível conferir as tentativas de faturamento.');
    const task = taskResult.data;
    const remote = (await olistRequest('pedido.obter.php', { id: remoteId })).pedido;
    if (!remote) throw new Error('Pedido Olist indisponível.');
    assertRemoteInvoiceOrder(order, remote, remoteId, link.tax_document ?? '');
    const remoteInvoice = String(remote.id_nota_fiscal ?? '');
    let invoiceId =
      task.invoice_id ??
      link.invoice_id ??
      (/^[1-9]\d{0,18}$/.test(remoteInvoice) ? remoteInvoice : null);
    if (invoiceId && remoteInvoice !== invoiceId)
      throw new Error('Vínculo da nota mudou na Olist; confira antes de continuar.');
    if (!invoiceId && operation === 'generate') {
      const claim = await db
        .from('olist_invoice_jobs')
        .update({
          generate_attempted_at: new Date().toISOString(),
          generate_actor: actorId,
          status: 'uncertain',
        })
        .eq('order_id', orderId)
        .is('generate_attempted_at', null)
        .is('invoice_id', null)
        .select('order_id')
        .maybeSingle();
      if (claim.error || !claim.data)
        throw new Error(
          'Geração anterior não confirmada. Confira a Olist; não será criada outra nota.',
        );
      const generated = await olistRequest('gerar.nota.fiscal.pedido.php', {
        id: remoteId,
        modelo: 'NFe',
      });
      let candidate = String(generated.registros?.[0]?.registro.idNotaFiscal ?? '');
      if (!/^[1-9]\d{0,18}$/.test(candidate)) {
        // Some V2 responses omit registros even though the order has been invoiced.
        // Recover by reading the same order; never send another generation request.
        const recovered = (await olistRequest('pedido.obter.php', { id: remoteId })).pedido;
        if (!recovered) throw new Error('Resultado da geração não confirmado; confira a Olist.');
        assertRemoteInvoiceOrder(order, recovered, remoteId, link.tax_document ?? '');
        candidate = String(recovered.id_nota_fiscal ?? '');
      }
      if (!/^[1-9]\d{0,18}$/.test(candidate))
        throw new Error('Resultado da geração não confirmado; confira a Olist.');
      invoiceId = candidate;
    }
    if (!invoiceId)
      throw new Error('A nota ainda não foi gerada ou seu vínculo está pendente na Olist.');
    const bound = await db
      .from('olist_invoice_jobs')
      .update({ invoice_id: invoiceId })
      .eq('order_id', orderId);
    if (bound.error) throw new Error('Não foi possível confirmar o vínculo fiscal.');
    let invoice = (await olistRequest('nota.fiscal.obter.php', { id: invoiceId })).nota_fiscal;
    if (!invoice) throw new Error('Nota fiscal indisponível.');
    assertRemoteInvoice(
      order,
      invoice,
      remoteId,
      invoiceId,
      link.tax_document ?? '',
      snapshot.data,
    );
    let status = invoiceState(invoice);
    if (operation === 'emit' && status === 'generated') {
      // Re-read approval immediately before sending the irreversible fiscal request.
      const latest = await db.from('orders').select('*').eq('id', orderId).single();
      if (latest.error) throw new Error('Não foi possível reconferir o pagamento.');
      assertInvoiceOrder(latest.data);
      await checkRefunds();
      const claim = await db
        .from('olist_invoice_jobs')
        .update({
          emit_attempted_at: new Date().toISOString(),
          emit_actor: actorId,
          status: 'uncertain',
        })
        .eq('order_id', orderId)
        .is('emit_attempted_at', null)
        .eq('invoice_id', invoiceId)
        .select('order_id')
        .maybeSingle();
      if (claim.error || !claim.data)
        throw new Error('Emissão já solicitada. Consulte a situação; não será enviada novamente.');
      await olistRequest('nota.fiscal.emitir.php', { id: invoiceId, enviarEmail: 'N' });
      invoice = (await olistRequest('nota.fiscal.obter.php', { id: invoiceId })).nota_fiscal;
      if (!invoice) throw new Error('Emissão solicitada; situação ainda não confirmada.');
      assertRemoteInvoice(
        order,
        invoice,
        remoteId,
        invoiceId,
        link.tax_document ?? '',
        snapshot.data,
      );
      status = invoiceState(invoice);
    }
    const saved = await db
      .from('olist_invoice_jobs')
      .update({ invoice_id: invoiceId, status, last_error: null })
      .eq('order_id', orderId);
    if (saved.error)
      throw new Error('Situação fiscal não registrada; consulte antes de tentar novamente.');
    const linked = await db
      .from('olist_orders')
      .update({ invoice_id: invoiceId })
      .eq('order_id', orderId);
    if (linked.error) throw new Error('Vínculo fiscal ainda não atualizado no pedido.');
    return { status, invoiceId };
  } catch (error) {
    const message =
      error instanceof OlistError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Falha de faturamento.';
    const saved = await db
      .from('olist_invoice_jobs')
      .update({ last_error: message })
      .eq('order_id', orderId);
    if (saved.error)
      throw new Error('Falha ao registrar a pendência fiscal. Confira a Olist antes de continuar.');
    throw error;
  }
}
