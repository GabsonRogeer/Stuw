import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import {
  fromOlistProduct,
  isStuwProduct,
  OLIST_CATEGORY,
  olistImageUrls,
  remoteSkus,
} from '@/services/olist-catalog';
import { validateProduct } from '@/services/product-admin';
import {
  getOlistProduct,
  listOlistProducts,
  olistRequest,
  OlistError,
  type OlistProduct,
} from './olist';
import { copyOlistImage } from './olist-images';
import { syncOlistOrder } from './olist-orders';
import { exportOne } from './olist-export';
import { syncOlistInventory } from './olist-inventory';
import { syncAutomaticOlistInvoice } from './olist-invoice-automation';

const fingerprint = (p: OlistProduct) =>
  createHash('sha256').update(JSON.stringify(p)).digest('hex');
function links(product: OlistProduct) {
  return remoteSkus(product).map((v) => ({ sku: v.codigo, remote_id: String(v.id) }));
}

async function importOne() {
  const db = createServiceClient();
  const cursor = await db.from('olist_cursor').select('*').eq('id', true).single();
  if (cursor.error) throw new Error('Cursor indisponível.');
  const page = await listOlistProducts(cursor.data.page);
  const entry = page.products[cursor.data.position];
  if (!entry) {
    const next = await db
      .from('olist_cursor')
      .update({ page: cursor.data.page < page.pages ? cursor.data.page + 1 : 1, position: 0 })
      .eq('id', true);
    if (next.error) throw new Error('Falha ao avançar catálogo.');
    return 'idle';
  }
  let status = 'ignored';
  let remoteHash: string | undefined;
  let message: string | null = null;
  try {
    const remote = !['V', 'P'].includes(entry.tipoVariacao ?? '')
      ? await getOlistProduct(String(entry.id))
      : null;
    if (remote && isStuwProduct(remote)) {
      remoteHash = fingerprint(remote);
      const linked = await db
        .from('olist_skus')
        .select('*')
        .eq('remote_id', String(entry.id))
        .maybeSingle();
      if (linked.error) throw new Error('Vínculos indisponíveis.');
      if (linked.data) {
        status = 'imported';
        if (linked.data.remote_hash && remoteHash !== linked.data.remote_hash) {
          status = 'conflict';
          message = 'Cadastro alterado na Olist. Revisar diferenças antes de sobrescrever o site.';
          const update = await db
            .from('olist_products')
            .update({ state: 'conflict', last_error: message })
            .eq('product_id', linked.data.product_id);
          if (update.error) throw new Error('Falha ao registrar conflito.');
        }
      } else {
        const previous = await db
          .from('olist_inbox')
          .select('*')
          .eq('remote_id', String(entry.id))
          .maybeSingle();
        if (previous.error) throw new Error('Histórico indisponível.');
        if (
          remote.classe_produto !== 'K' &&
          previous.data?.state === 'blocked' &&
          previous.data.remote_hash === remoteHash
        ) {
          status = 'blocked';
          message = previous.data.last_error;
        } else {
          const draft = fromOlistProduct(remote);
          if (remote.classe_produto === 'K') {
            if (!remote.kit?.length) throw new Error('Kit sem componentes.');
            const componentLinks = await db
              .from('olist_skus')
              .select('*')
              .in(
                'remote_id',
                remote.kit.map((c) => String(c.item.id_produto)),
              );
            if (componentLinks.error || componentLinks.data.length !== remote.kit.length)
              throw new Error('Importe os componentes do kit primeiro.');
            const componentProducts = await db
              .from('admin_products')
              .select('id,document')
              .in(
                'id',
                componentLinks.data.map((l) => l.product_id),
              );
            if (componentProducts.error) throw new Error('Componentes indisponíveis.');
            const composition = remote.kit.map((c) => {
              const link = componentLinks.data.find(
                (l) => l.remote_id === String(c.item.id_produto),
              )!;
              const p = componentProducts.data.find((p) => p.id === link.product_id)!;
              const color = p.document.colors.find((c) => c.skus.some((s) => s.code === link.sku))!;
              const sku = color.skus.find((s) => s.code === link.sku)!;
              return { sku: sku.code, quantity: Number(c.item.quantidade), color, size: sku.size };
            });
            if (
              composition.some(
                (c) => c.size !== composition[0].size || c.color.slug !== composition[0].color.slug,
              )
            )
              throw new Error('Kit exige mesma cor e tamanho.');
            draft.sizes = [composition[0].size];
            const target = draft.colors[0];
            target.name = composition[0].color.name;
            target.slug = composition[0].color.slug;
            target.hex = composition[0].color.hex;
            target.skus[0].size = composition[0].size;
            target.skus[0].components = composition.map((c) => ({
              sku: c.sku,
              quantity: c.quantity,
            }));
          }
          const invalid = validateProduct(draft);
          if (invalid) throw new Error(invalid);
          const images = [];
          const imageDeadline = Date.now() + 45000;
          for (const url of olistImageUrls(remote)) {
            try {
              if (Date.now() > imageDeadline) throw new Error('Image budget exhausted');
              images.push({
                src: await copyOlistImage(url),
                alt: draft.name,
                role: 'frente' as const,
              });
            } catch {
              message = 'Rascunho importado; uma imagem requer envio manual no painel.';
            }
          }
          draft.colors[0].images = images;
          const imported = await db.rpc('import_olist_product', {
            erp_id: String(remote.id),
            doc: draft,
            sku_links: links(remote),
            hash_seen: remoteHash,
          });
          if (imported.error)
            throw new Error('Conflito de SKU, GTIN ou slug. Nenhum cadastro parcial foi gravado.');
          const linked = await db.rpc('link_olist_sku', {
            local_id: imported.data,
            sku_code: remote.codigo,
            erp_id: String(remote.id),
            hash_seen: remoteHash,
          });
          if (linked.error) throw new Error('Cadastro importado; revisar vínculo do SKU.');
          status = 'imported';
        }
      }
    }
  } catch (error) {
    status = 'blocked';
    message =
      error instanceof OlistError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Falha ao importar.';
  }
  const saved = await db.from('olist_inbox').upsert({
    remote_id: String(entry.id),
    name: entry.nome,
    state: status,
    last_error: message?.slice(0, 300) ?? null,
    remote_hash: remoteHash,
    updated_at: new Date().toISOString(),
  });
  if (saved.error) throw new Error('Não foi possível registrar a importação.');
  const next = await db
    .from('olist_cursor')
    .update({ position: cursor.data.position + 1 })
    .eq('id', true);
  if (next.error) throw new Error('Falha ao avançar catálogo.');
  return status;
}

export async function syncOlistCatalog(
  direction: 'export' | 'import' | 'orders' | 'stock' | 'invoices' = 'export',
) {
  if (
    process.env.OLIST_ENABLED !== 'true' &&
    !(direction === 'stock' && process.env.OLIST_STOCK_ENABLED === 'true')
  )
    return { enabled: false };
  if (direction === 'export') {
    const tree = await olistRequest('produtos.categorias.arvore.php');
    if (
      !tree.categorias?.some(
        (category) => category.descricao.trim().toLowerCase() === OLIST_CATEGORY.toLowerCase(),
      )
    )
      return { enabled: true, direction, result: 'category_missing' };
  }
  const db = createServiceClient();
  const worker = randomUUID();
  const claim = await db.rpc('claim_olist_sync', { worker });
  if (claim.error) throw new Error('Aplique a migração Olist antes de executar.');
  if (!claim.data) return { enabled: true, busy: true };
  try {
    return {
      enabled: true,
      direction,
      result: await (direction === 'stock'
        ? syncOlistInventory()
        : direction === 'export'
          ? exportOne()
          : direction === 'orders'
            ? syncOlistOrder()
            : direction === 'invoices'
              ? syncAutomaticOlistInvoice()
              : importOne()),
    };
  } finally {
    const release = await db
      .from('olist_cursor')
      .update({ locked_until: new Date().toISOString(), owner: null })
      .eq('id', true)
      .eq('owner', worker);
    if (release.error) console.warn('[olist] Falha ao liberar execução; aguardar expiração.');
  }
}
