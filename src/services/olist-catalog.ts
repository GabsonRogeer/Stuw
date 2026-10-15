import {
  emptyProduct,
  slugify,
  PRODUCT_SIZES,
  type AdminProduct,
  type ProductDraft,
} from '@/services/product-admin';
import type { OlistProduct } from '@/lib/integrations/olist';

export const OLIST_CATEGORY = 'Stuw';
export function isStuwProduct(product: Pick<OlistProduct, 'categoria'>) {
  return product.categoria?.split('>>')[0]?.trim().toLowerCase() === OLIST_CATEGORY.toLowerCase();
}

export function productExportIssues(product: AdminProduct) {
  const p = product.document;
  const issues: string[] = [];
  if (!p.name || p.name.length > 120) issues.push('Nome deve ter até 120 caracteres.');
  if (!/^[0-8]$/.test(p.origin)) issues.push('Preencha a origem fiscal (0 a 8).');
  if (!p.unit || p.unit.length > 3) issues.push('Preencha a unidade fiscal.');
  if (p.price === null || !Number.isFinite(p.price) || p.price <= 0)
    issues.push('Preencha o preço de venda.');
  const skus = p.colors.flatMap((color) => color.skus);
  if (!skus.length) issues.push('Cadastre ao menos um SKU.');
  if (skus.length > 20) issues.push('Mais de 20 variações: sincronização assistida necessária.');
  if (new Set(skus.map((s) => s.code)).size !== skus.length) issues.push('Há SKUs repetidos.');
  if (skus.some((s) => !/^[A-Z0-9_-]{1,30}$/.test(s.code)))
    issues.push('SKUs devem ter até 30 caracteres, sem espaços.');
  if (p.colors.some((c) => !c.active || c.skus.some((s) => !s.active)))
    issues.push('Revise variações inativas antes da exportação inicial.');
  return issues;
}

export function toOlistSku(
  product: AdminProduct,
  code: string,
  site: string,
  componentLinks: { sku: string; remote_id: string }[] = [],
) {
  const issues = productExportIssues(product);
  if (issues.length) throw new Error(issues.join(' '));
  const p = product.document;
  const color = p.colors.find((c) => c.skus.some((s) => s.code === code));
  const sku = color?.skus.find((s) => s.code === code);
  if (!color || !sku) throw new Error('SKU não encontrado.');
  const components = sku.components ?? [];
  const kit = components.map((component) => {
    const link = componentLinks.find((l) => l.sku === component.sku);
    if (!link) throw new Error('Cadastre os componentes na Olist antes do conjunto.');
    return { item: { id_produto: link.remote_id, quantidade: component.quantity } };
  });
  const origin = new URL(site);
  if (origin.protocol !== 'https:')
    throw new Error('Configure a URL pública HTTPS para exportar imagens.');
  const images = [...new Set(color.images.map((i) => i.src))];
  const name = `${p.name}${p.name.toLowerCase().includes(color.name.toLowerCase()) ? '' : ` ${color.name}`} ${sku.size}`;
  if (name.length > 120) throw new Error('Nome com cor e tamanho excede 120 caracteres.');
  return {
    sequencia: 1,
    codigo: sku.code,
    nome: name,
    unidade: p.unit,
    preco: (sku.price ?? color.price ?? p.price!).toFixed(2),
    origem: p.origin,
    situacao: p.status === 'inactive' ? 'I' : 'A',
    tipo: 'P',
    classe_produto: components.length ? 'K' : 'S',
    ...(kit.length ? { kit } : {}),
    // Opening balance only on creation; never send this field in an update request.
    ...(!kit.length ? { estoque_atual: sku.stock } : {}),
    ...(sku.gtin ? { gtin: sku.gtin } : {}),
    marca: p.brand,
    categoria: OLIST_CATEGORY,
    ...(p.ncm ? { ncm: p.ncm } : {}),
    ...(p.cest ? { cest: p.cest } : {}),
    descricao_complementar: p.description,
    ...(p.weight ? { peso_bruto: p.weight / 1000 } : {}),
    ...(p.height ? { altura_embalagem: p.height } : {}),
    ...(p.width ? { largura_embalagem: p.width } : {}),
    ...(p.length ? { comprimento_embalagem: p.length } : {}),
    imagens_externas: images.map((src) => ({ imagem_externa: { url: new URL(src, origin).href } })),
  };
}

export function remoteSkus(product: OlistProduct) {
  return product.tipoVariacao === 'P' || product.variacoes?.length
    ? (product.variacoes ?? []).map((v) => v.variacao)
    : [product];
}

export function olistImageUrls(product: OlistProduct) {
  return [
    ...new Set([
      ...(product.anexos ?? []).map((a) => a.anexo),
      ...(product.imagens_externas ?? []).map((a) => a.imagem_externa.url),
    ]),
  ].slice(0, 12);
}

export function fromOlistProduct(product: OlistProduct): ProductDraft {
  if (
    !/^[1-9]\d{0,18}$/.test(String(product.id)) ||
    !product.nome ||
    product.tipo === 'S' ||
    (product.classe_produto && !['S', 'K'].includes(product.classe_produto)) ||
    product.tipoVariacao === 'V' ||
    product.tipoVariacao === 'P'
  )
    throw new Error('Produto incompatível: use produtos simples ou kits, sem variações.');
  const draft = emptyProduct();
  draft.name = product.nome.slice(0, 160);
  draft.slug = `olist-${product.id}-${slugify(product.nome).slice(0, 100)}`;
  draft.source = 'olist';
  draft.externalId = String(product.id);
  // Imported descriptions are displayed as text, never rendered as trusted HTML.
  draft.description = (product.descricao_complementar ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?\s*>|<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
    .slice(0, 10000);
  draft.brand = (product.marca ?? '').slice(0, 80);
  draft.price = Number(product.preco) > 0 ? Number(product.preco) : null;
  draft.origin = /^[0-8]$/.test(product.origem ?? '') ? product.origem! : '';
  draft.ncm = (product.ncm ?? '').replace(/\D/g, '');
  draft.cest = (product.cest ?? '').replace(/\D/g, '');
  draft.unit = ['UN', 'PC', 'CJ', 'PAR'].includes(product.unidade ?? '') ? product.unidade! : '';
  const number = (value: unknown) =>
    Number(value) > 0 && Number.isFinite(Number(value)) ? Number(value) : null;
  draft.weight = number(product.peso_bruto) ? Number(product.peso_bruto) * 1000 : null;
  draft.height = number(product.alturaEmbalagem);
  draft.width = number(product.larguraEmbalagem);
  draft.length = number(product.comprimentoEmbalagem);
  for (const variant of remoteSkus(product)) {
    if (!/^[A-Z0-9_-]{1,30}$/.test(variant.codigo ?? ''))
      throw new Error(
        'SKU Olist incompatível: use letras maiúsculas, números, hífen ou sublinhado, até 30 caracteres.',
      );
    const size = variant.grade?.Tamanho ?? /-(GG|P|M|G)$/.exec(variant.codigo)?.[1] ?? 'Único';
    if (!PRODUCT_SIZES.includes(size as (typeof PRODUCT_SIZES)[number]))
      throw new Error('Tamanho Olist não suportado no site.');
    const colorName = variant.grade?.Cor ?? 'Padrão';
    const colorSlug = slugify(colorName);
    if (!colorSlug || colorName.length > 100) throw new Error('Cor inválida.');
    let color = draft.colors.find((c) => c.slug === colorSlug);
    if (!color) {
      color = {
        name: colorName,
        slug: colorSlug,
        hex: '#808080',
        swatch: '',
        active: true,
        price: null,
        images: [],
        skus: [],
      };
      draft.colors.push(color);
    }
    if (color.skus.some((s) => s.size === size)) throw new Error('Grade duplicada na Olist.');
    color.skus.push({
      code: variant.codigo,
      size,
      gtin: variant.gtin ?? '',
      stock: 0,
      price: number(variant.preco),
      active: true,
    });
    if (!draft.sizes.includes(size)) draft.sizes.push(size);
  }
  if (!draft.colors.length) throw new Error('Produto sem variações utilizáveis.');
  draft.lastSync = new Date().toISOString();
  return draft;
}
