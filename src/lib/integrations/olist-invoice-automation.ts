import 'server-only';
import { randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { assertInvoiceOrder } from '@/services/olist-invoices';
import type { Database } from '@/types/database';
import { getOlistProduct, OlistError } from './olist';
import { processOlistInvoice } from './olist-invoices';

function configured() {
  return (
    process.env.MERCADO_PAGO_ENVIRONMENT === 'production' &&
    process.env.OLIST_ENABLED === 'true' &&
    process.env.OLIST_INVOICE_ENABLED === 'true' &&
    Boolean(process.env.OLIST_API_TOKEN)
  );
}

// Read-only deployment check. Does not claim jobs or contact the fiscal provider.
export async function getInvoiceAutomationStatus() {
  const result = await createServiceClient()
    .from('olist_invoice_automation')
    .select('enabled,activated_at')
    .eq('id', true)
    .single();
  if (result.error) throw new Error('Configuração do faturamento indisponível.');
  return {
    ready: configured(),
    automaticEnabled: result.data.enabled,
    activatedAt: result.data.activated_at,
  };
}

export async function syncAutomaticOlistInvoice() {
  if (!configured()) return 'disabled';
  const db = createServiceClient();
  const worker = randomUUID();
  const claimed = await db.rpc('claim_automatic_olist_invoice', { worker });
  if (claimed.error) throw new Error('Fila de faturamento indisponível.');
  const task = claimed.data?.[0];
  if (!task) return 'idle';

  // Every update must still own the lease. Fiscal writes have their own immutable
  // compare-and-set attempts, shared with the manual admin workflow.
  async function save(patch: Database['public']['Tables']['olist_invoice_jobs']['Update']) {
    const saved = await db
      .from('olist_invoice_jobs')
      .update(patch)
      .eq('order_id', task.order_id)
      .eq('lease_owner', worker)
      .select('order_id')
      .maybeSingle();
    if (saved.error || !saved.data) throw new Error('Não foi possível registrar a fila fiscal.');
  }
  const release = {
    lease_owner: null,
    lease_until: null,
    next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
  };
  try {
    if (task.automation_attempts > 60)
      throw new Error('Limite de consultas atingido. Confira a situação da NF na Olist.');
    const order = await db.from('orders').select('*').eq('id', task.order_id).single();
    if (order.error) throw new Error('Pedido indisponível para conferência fiscal.');
    assertInvoiceOrder(order.data);
    const refunds = await db
      .from('order_refunds')
      .select('id', { head: true, count: 'exact' })
      .eq('order_id', task.order_id);
    if (refunds.error || refunds.count !== 0)
      throw new Error('Pedido com reembolso ou conciliação indisponível. Revise o faturamento.');

    if (!task.invoice_id && !task.generate_attempted_at) {
      const snapshot = await db.rpc('get_olist_invoice_components', { input_order: task.order_id });
      if (snapshot.error || !snapshot.data?.length)
        throw new Error('Reserva original dos componentes indisponível para conferência fiscal.');
      const pending = snapshot.data
        .map((item) => item.sku)
        .filter((sku) => !task.validated_skus.includes(sku));
      if (pending.length) {
        // Bound each run to three provider reads. Large carts resume validation
        // from the immutable reservation instead of timing out and restarting.
        const codes = pending.slice(0, 3);
        const links = await db
          .from('olist_skus')
          .select('sku,remote_id')
          .in('sku', codes)
          .eq('state', 'linked');
        if (links.error) throw new Error('Vínculos fiscais indisponíveis.');
        const checked = [...task.validated_skus];
        for (const sku of codes) {
          const id = links.data.find((link) => link.sku === sku)?.remote_id;
          if (!id) throw new Error(`SKU ${sku} sem vínculo fiscal na Olist.`);
          const product = await getOlistProduct(id);
          if (
            product.codigo !== sku ||
            !/^(?!0{8}$)\d{8}$/.test(String(product.ncm ?? '').replace(/[.\s]/g, '')) ||
            !/^[0-8]$/.test(String(product.origem ?? '')) ||
            !product.unidade?.trim()
          )
            throw new Error(`Confira NCM, origem, unidade e código do SKU ${sku} na Olist.`);
          checked.push(sku);
          await save({ validated_skus: checked });
        }
        await save({ ...release, last_error: null });
        return 'validated';
      }
    }

    // An uncertain write is only reconciled through reads. A second generation
    // or authorization request is never inferred from a timeout or a draft state.
    const operation = task.invoice_id
      ? task.emit_attempted_at
        ? 'refresh'
        : 'emit'
      : task.generate_attempted_at
        ? 'refresh'
        : 'generate';
    const result = await processOlistInvoice(task.order_id, null, operation);
    await save({
      ...release,
      status: result.status,
      last_error:
        result.status === 'blocked' ? 'Nota rejeitada, cancelada ou com pendência na Olist.' : null,
    });
    return result.status;
  } catch (error) {
    const retryable =
      error instanceof OlistError &&
      /^(CONNECTION|RESPONSE_INVALID|HTTP_(429|5\d\d))$/.test(error.code);
    await save({
      ...release,
      ...(retryable ? {} : { status: 'blocked' }),
      next_attempt_at: new Date(Date.now() + 120_000).toISOString(),
      last_error: (error instanceof Error ? error.message : 'Falha de faturamento.').slice(0, 500),
    });
    return retryable ? 'retry' : 'blocked';
  }
}
