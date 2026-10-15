import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { olistRequest } from './olist';

export function parseOlistStock(value: unknown, id: string, sku: string) {
  const p = value as Record<string, unknown> | undefined;
  if (!p || String(p.id) !== id || p.codigo !== sku)
    throw new Error('Identidade do estoque divergente.');
  const number = (v: unknown) => {
    if ((typeof v !== 'number' && typeof v !== 'string') || v === '')
      throw new Error('Saldo ausente.');
    const n = Number(v);
    if (!Number.isSafeInteger(n) || Math.abs(n) > 1_000_000) throw new Error('Saldo inválido.');
    return n;
  };
  const physical = number(p.saldo);
  // The reservation field is absent when the ERP reservation extension is disabled.
  const reserved = p.saldoReservado === undefined ? 0 : number(p.saldoReservado);
  if (reserved < 0) throw new Error('Reserva inválida.');
  return { physical, reserved };
}

export async function syncOlistInventory() {
  const db = createServiceClient();
  const [links, products] = await Promise.all([
    db.from('olist_skus').select('sku,remote_id,product_id').eq('state', 'linked'),
    db.from('admin_products').select('id,document').is('deleted_at', null),
  ]);
  if (links.error || products.error) throw new Error('Catálogo indisponível.');
  const units = links.data.filter(
    (l) =>
      l.remote_id &&
      products.data.some(
        (p) =>
          p.id === l.product_id &&
          p.document.colors.some((c) =>
            c.skus.some((s) => s.code === l.sku && !s.components?.length),
          ),
      ),
  );
  if (!units.length) return 'idle';
  const queued = await db.from('olist_inventory').upsert(
    units.map((l) => ({ sku: l.sku })),
    { onConflict: 'sku', ignoreDuplicates: true },
  );
  if (queued.error) throw new Error('Fila de estoque indisponível.');
  const due = await db
    .from('olist_inventory')
    .select('*')
    .lte('next_check_at', new Date().toISOString())
    .order('next_check_at')
    .order('sku')
    .limit(12);
  if (due.error) throw new Error('Fila de estoque indisponível.');
  let synced = 0;
  let review = 0;
  const started = Date.now();
  for (const task of due.data) {
    if (Date.now() - started > 65_000) break;
    try {
      const link = units.find((l) => l.sku === task.sku);
      if (!link?.remote_id) throw new Error('Vínculo de estoque indisponível.');
      const observed = new Date().toISOString();
      const response = await olistRequest('produto.obter.estoque.php', { id: link.remote_id });
      const stock = parseOlistStock(response.produto, link.remote_id, task.sku);
      const result = await db.rpc('apply_olist_inventory', {
        code: task.sku,
        erp_id: link.remote_id,
        physical_stock: stock.physical,
        reserved_stock: stock.reserved,
        observed,
      });
      if (result.error) throw new Error('Falha ao aplicar saldo.');
      if (result.data === 'review') review++;
      else synced++;
    } catch (error) {
      const saved = await db
        .from('olist_inventory')
        .update({
          checked_at: new Date().toISOString(),
          next_check_at: new Date(Date.now() + 120_000).toISOString(),
          error:
            error instanceof Error ? error.message.slice(0, 250) : 'Falha ao consultar estoque.',
        })
        .eq('sku', task.sku);
      if (saved.error) throw new Error('Falha ao registrar pendência de estoque.');
      // Stop on provider failure to avoid exhausting a throttled API.
      return { synced, review, failed: task.sku };
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  return { synced, review, mode: due.data.some((r) => r.enabled) ? 'active' : 'observation' };
}
