import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { toOlistOrder } from '@/services/olist-orders';
import { olistRequest, OlistError } from './olist';

export async function syncOlistOrder() {
  const db = createServiceClient();
  const rows = await db
    .from('olist_orders')
    .select('*')
    .in('state', ['pending', 'uncertain', 'linked'])
    .order('updated_at')
    .limit(1);
  if (rows.error) throw new Error('Fila de pedidos indisponível.');
  const task = rows.data[0];
  if (!task) return 'idle';
  let writing = false;
  try {
    const result = await db.from('orders').select('*').eq('id', task.order_id).single();
    if (result.error) throw new Error('Pedido indisponível.');
    const order = result.data;
    if (order.is_demo || order.payment_test_mode || order.payment_status !== 'approved')
      throw new Error('Pedido não está aprovado. Conferir cancelamento ou estorno.');
    let remoteId = task.remote_id;
    if (!remoteId) {
      let matches: Record<string, unknown>[] = [];
      try {
        const found = await olistRequest('pedidos.pesquisa.php', { numeroEcommerce: order.number });
        if (Number(found.numero_paginas ?? 1) > 1)
          throw new Error('Mais de uma página de pedidos: revisar duplicidade.');
        matches = found.pedidos?.map((p) => p.pedido) ?? [];
      } catch (error) {
        if (!(error instanceof OlistError && error.code === 'API_20')) throw error;
      }
      if (matches.length > 1)
        throw new Error('Pedido duplicado na Olist: reconciliar manualmente.');
      if (matches[0]) remoteId = String(matches[0].id);
      else {
        if (task.attempted_at)
          throw new Error('Inclusão anterior incerta; conferir na Olist antes de repetir.');
        const linked = await db
          .from('olist_skus')
          .select('*')
          .in(
            'sku',
            order.items.map((i) => i.sku ?? ''),
          );
        if (linked.error) throw new Error('Vínculos indisponíveis.');
        const products = await db
          .from('admin_products')
          .select('id,document')
          .in('id', [...new Set(linked.data.map((s) => s.product_id))]);
        if (products.error) throw new Error('Dados fiscais dos produtos indisponíveis.');
        const payload = toOlistOrder(
          order,
          task.tax_document ?? '',
          linked.data
            .filter((s) => s.state === 'linked' && s.remote_id)
            .map((s) => ({
              ...s,
              remote_id: s.remote_id!,
              unit: products.data.find((p) => p.id === s.product_id)?.document.unit ?? '',
            })),
        );
        const claim = await db
          .from('olist_orders')
          .update({ state: 'uncertain', attempted_at: new Date().toISOString() })
          .eq('order_id', order.id)
          .is('attempted_at', null)
          .select('order_id')
          .maybeSingle();
        if (claim.error || !claim.data) throw new Error('Inclusão já reservada.');
        writing = true;
        const created = await olistRequest('pedido.incluir.php', {
          pedido: JSON.stringify({ pedido: payload }),
        });
        const record = created.registros?.[0]?.registro;
        if (!record?.id || (record.status && record.status !== 'OK'))
          throw new Error('Resultado de inclusão não confirmado.');
        remoteId = String(record.id);
      }
    }
    const remote = (await olistRequest('pedido.obter.php', { id: remoteId })).pedido;
    if (
      !remote ||
      remote.numero_ecommerce !== order.number ||
      !Number.isFinite(Number(remote.total_pedido)) ||
      Math.round(Number(remote.total_pedido) * 100) !== order.total_cents
    )
      throw new Error(
        'Pedido Olist com referência ou total divergente. Não emitir NF antes de conferir.',
      );
    const invoice = String(remote.id_nota_fiscal ?? '');
    const saved = await db
      .from('olist_orders')
      .update({
        remote_id: remoteId,
        state: 'linked',
        invoice_id: /^[1-9]\d*$/.test(invoice) ? invoice : null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', order.id);
    if (saved.error) throw new Error('Vínculo local não confirmado.');
    return 'linked';
  } catch (error) {
    const saved = await db
      .from('olist_orders')
      .update({
        state: writing || task.attempted_at ? 'uncertain' : 'blocked',
        last_error:
          error instanceof OlistError
            ? error.message
            : error instanceof Error
              ? error.message.slice(0, 300)
              : 'Falha Olist.',
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', task.order_id);
    if (saved.error) throw new Error('Falha ao registrar pendência.');
    return 'blocked';
  }
}
