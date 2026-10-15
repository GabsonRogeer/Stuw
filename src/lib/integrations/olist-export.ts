import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { isStuwProduct, productExportIssues, toOlistSku } from '@/services/olist-catalog';
import { getOlistProduct, listOlistProducts, olistRequest, OlistError } from './olist';

export async function exportOne() {
  const db = createServiceClient();
  const tasks = await db
    .from('olist_products')
    .select('*')
    .in('state', ['pending', 'uncertain'])
    .order('updated_at')
    .limit(100);
  if (tasks.error) throw new Error('Fila indisponível.');
  if (!tasks.data.length) return 'idle';
  const products = await db
    .from('admin_products')
    .select('*')
    .in(
      'id',
      tasks.data.map((t) => t.product_id),
    )
    .is('deleted_at', null);
  if (products.error) throw new Error('Catálogo indisponível.');
  // Components must exist in the ERP before a kit can reference them.
  const product = products.data.sort(
    (a, b) =>
      Number(a.document.colors.some((c) => c.skus.some((s) => s.components?.length))) -
      Number(b.document.colors.some((c) => c.skus.some((s) => s.components?.length))),
  )[0];
  if (!product) return 'idle';
  const issues = productExportIssues(product);
  if (issues.length) {
    const r = await db
      .from('olist_products')
      .update({ state: 'blocked', last_error: issues.join(' ') })
      .eq('product_id', product.id);
    if (r.error) throw new Error('Falha ao registrar pendência.');
    return 'blocked';
  }
  const skus = product.document.colors.flatMap((c) => c.skus);
  const queued = await db.from('olist_skus').upsert(
    skus.map((s) => ({ sku: s.code, product_id: product.id, state: 'pending' })),
    { onConflict: 'sku', ignoreDuplicates: true },
  );
  if (queued.error) throw new Error('Falha ao preparar SKUs.');
  const records = await db.from('olist_skus').select('*').eq('product_id', product.id);
  if (records.error) throw new Error('Vínculos indisponíveis.');
  const task = records.data.find((r) => ['pending', 'uncertain'].includes(r.state));
  if (!task) return 'idle';
  const sku = skus.find((s) => s.code === task.sku)!;
  let writing = false;
  try {
    const componentCodes = (sku.components ?? []).map((c) => c.sku);
    const components = componentCodes.length
      ? await db.from('olist_skus').select('sku,remote_id,state').in('sku', componentCodes)
      : { data: [], error: null };
    if (components.error) throw new Error('Componentes indisponíveis.');
    const componentLinks = components.data.flatMap((l) =>
      l.state === 'linked' && l.remote_id ? [{ sku: l.sku, remote_id: l.remote_id }] : [],
    );
    const payload = toOlistSku(
      product,
      sku.code,
      process.env.NEXT_PUBLIC_SITE_URL ?? '',
      componentLinks,
    );
    const search = await listOlistProducts(1, sku.code);
    if (search.pages > 1) throw new Error('Busca ambígua: revisar SKU na Olist.');
    const matches = search.products.filter((p) => p.codigo === sku.code);
    if (matches.length > 1) throw new Error('SKU duplicado na Olist.');
    let remote;
    if (matches.length) {
      if (!task.attempted_at && !task.remote_id)
        throw new Error('SKU já existe sem vínculo confirmado.');
      remote = await getOlistProduct(String(matches[0].id));
    } else {
      if (task.attempted_at)
        throw new Error('Inclusão incerta: conferir na Olist antes de repetir.');
      const claim = await db
        .from('olist_skus')
        .update({ state: 'uncertain', attempted_at: new Date().toISOString() })
        .eq('sku', sku.code)
        .is('attempted_at', null)
        .select('sku')
        .maybeSingle();
      if (claim.error || !claim.data) throw new Error('Inclusão já reservada.');
      writing = true;
      const result = await olistRequest('produto.incluir.php', {
        produto: JSON.stringify({ produtos: [{ produto: payload }] }),
      });
      const record = result.registros?.[0]?.registro;
      if (record?.status !== 'OK' || !record.id) throw new Error('Inclusão não confirmada.');
      remote = await getOlistProduct(String(record.id));
    }
    // Explicit assisted-load exception: only an empty category may be assigned manually.
    // A product classified in another category remains a conflict.
    const manualCategory =
      process.env.OLIST_MANUAL_CATEGORY === 'true' && !remote.categoria?.trim();
    if (
      remote.codigo !== sku.code ||
      remote.tipoVariacao === 'V' ||
      remote.tipoVariacao === 'P' ||
      remote.classe_produto !== payload.classe_produto ||
      (!isStuwProduct(remote) && !manualCategory)
    )
      throw new Error('Tipo, SKU ou categoria divergente na Olist.');
    if (
      payload.kit &&
      (remote.kit?.length !== payload.kit.length ||
        payload.kit.some(
          (c) =>
            !remote.kit?.some(
              (r) =>
                String(r.item.id_produto) === c.item.id_produto &&
                Number(r.item.quantidade) === c.item.quantidade,
            ),
        ))
    )
      throw new Error('Composição do conjunto divergente na Olist.');
    const linked = await db.rpc('link_olist_sku', {
      local_id: product.id,
      sku_code: sku.code,
      erp_id: String(remote.id),
      hash_seen: createHash('sha256').update(JSON.stringify(remote)).digest('hex'),
    });
    if (linked.error) throw new Error('Vínculo exige reconciliação.');
    if (manualCategory) {
      const warning = await db
        .from('olist_skus')
        .update({
          last_error: 'Categoria Stuw pendente de classificação manual autorizada.',
        })
        .eq('sku', sku.code);
      if (warning.error) throw new Error('Falha ao registrar categoria pendente.');
    }
    return manualCategory ? 'linked_category_pending' : 'linked';
  } catch (error) {
    const state = writing || task.attempted_at ? 'uncertain' : 'blocked';
    const message =
      error instanceof OlistError || error instanceof Error
        ? error.message.slice(0, 300)
        : 'Falha de sincronização.';
    const row = await db
      .from('olist_skus')
      .update({ state, last_error: message })
      .eq('sku', sku.code);
    const parent = await db
      .from('olist_products')
      .update({ state, last_error: message, updated_at: new Date().toISOString() })
      .eq('product_id', product.id);
    if (row.error || parent.error) throw new Error('Falha ao registrar pendência.');
    return state;
  }
}
