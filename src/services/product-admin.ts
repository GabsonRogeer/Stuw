import { categories, activityCategories, fabrics, occasions } from '@/data/navigation';
import type { Product } from '@/types';

export const PRODUCT_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'Único'] as const;
export const PRODUCT_BUCKET = 'product-images';
export const MAX_PRODUCT_IMAGE = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export type ProductMedia = {
  src: string;
  alt: string;
  role: 'frente' | 'costas' | 'detalhe' | 'lifestyle';
};
export type ProductSku = {
  size: string;
  code: string;
  gtin: string;
  stock: number;
  price: number | null;
  active: boolean;
};
export type AdminColor = {
  name: string;
  slug: string;
  hex: string;
  swatch: string;
  active: boolean;
  price: number | null;
  images: ProductMedia[];
  skus: ProductSku[];
};
export type ProductDraft = {
  name: string;
  slug: string;
  summary: string;
  description: string;
  highlights: string;
  brand: string;
  category: string;
  activityCategory: string;
  occasion: string;
  gender: string;
  collection: string;
  tags: string;
  fabric: string;
  composition: string;
  fit: string;
  waist: string;
  compression: string;
  support: string;
  care: string;
  technical: string;
  sizes: string[];
  colors: AdminColor[];
  price: number | null;
  comparePrice: number | null;
  cost: number | null;
  salePrice: number | null;
  saleStart: string;
  saleEnd: string;
  wholesalePrice: number | null;
  wholesaleMinimum: number;
  wholesalePack: string;
  measurements: string;
  sizeGuide: string;
  ncm: string;
  cest: string;
  origin: string;
  unit: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  status: 'draft' | 'active' | 'inactive';
  publishAt: string;
  featured: boolean;
  externalId: string;
  source: string;
  lastSync: string;
};
export type AdminProduct = {
  id: number;
  document: ProductDraft;
  revision: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
};
export type ProductField = {
  key: keyof ProductDraft;
  label: string;
  type?: 'textarea' | 'number' | 'datetime-local';
  options?: readonly string[];
  required?: boolean;
  hint?: string;
  max?: number;
};
export const PRODUCT_SECTIONS: { title: string; fields: ProductField[] }[] = [
  {
    title: 'Identificação e conteúdo',
    fields: [
      { key: 'name', label: 'Nome do modelo (sem a cor)', required: true, max: 160 },
      {
        key: 'slug',
        label: 'Slug',
        required: true,
        max: 160,
        hint: 'A URL anterior é preservada quando o slug muda.',
      },
      { key: 'summary', label: 'Descrição curta', max: 300 },
      { key: 'description', label: 'Descrição completa', type: 'textarea', max: 10000 },
      { key: 'highlights', label: 'Destaques (um por linha)', type: 'textarea' },
      { key: 'brand', label: 'Marca', max: 80 },
    ],
  },
  {
    title: 'Classificação',
    fields: [
      { key: 'category', label: 'Tipo de peça', options: categories.map((c) => c.value) },
      {
        key: 'activityCategory',
        label: 'Linha de uso',
        options: activityCategories.map((c) => c.value),
      },
      { key: 'occasion', label: 'Ocasião', options: occasions },
      { key: 'gender', label: 'Gênero', options: ['Feminino', 'Masculino', 'Unissex'] },
      { key: 'collection', label: 'Coleção' },
      { key: 'tags', label: 'Tags (separadas por vírgula)' },
    ],
  },
  {
    title: 'Tecido e atributos de moda',
    fields: [
      { key: 'fabric', label: 'Tecnologia', options: fabrics },
      {
        key: 'composition',
        label: 'Composição',
        hint: 'Ex.: Poliamida: 80; Elastano: 20. Percentuais devem somar 100.',
      },
      { key: 'fit', label: 'Modelagem' },
      { key: 'waist', label: 'Cintura', options: ['Alta', 'Média', 'Baixa', 'Não se aplica'] },
      {
        key: 'compression',
        label: 'Compressão',
        options: ['Leve', 'Média', 'Alta', 'Não se aplica'],
      },
      { key: 'support', label: 'Suporte', options: ['Leve', 'Médio', 'Alto', 'Não se aplica'] },
      { key: 'care', label: 'Cuidados de lavagem', type: 'textarea' },
      {
        key: 'technical',
        label: 'Ficha técnica',
        type: 'textarea',
        hint: 'Uma linha por atributo: chave: valor.',
      },
    ],
  },
  {
    title: 'Preços, promoções e atacado',
    fields: [
      { key: 'price', label: 'Preço de venda (R$)', type: 'number' },
      { key: 'comparePrice', label: 'Preço anterior / de (R$)', type: 'number' },
      { key: 'cost', label: 'Custo interno (R$)', type: 'number' },
      { key: 'salePrice', label: 'Preço promocional (R$)', type: 'number' },
      { key: 'saleStart', label: 'Início da promoção', type: 'datetime-local' },
      { key: 'saleEnd', label: 'Fim da promoção', type: 'datetime-local' },
      { key: 'wholesalePrice', label: 'Preço de atacado (R$)', type: 'number' },
      { key: 'wholesaleMinimum', label: 'Quantidade mínima no atacado', type: 'number' },
      {
        key: 'wholesalePack',
        label: 'Grade / cartela de atacado',
        type: 'textarea',
        hint: 'Condição comercial para análise na cotação.',
      },
    ],
  },
  {
    title: 'Medidas e guia de tamanhos',
    fields: [
      {
        key: 'measurements',
        label: 'Tabela de medidas (cm)',
        type: 'textarea',
        hint: 'Uma linha por tamanho: P: busto 84–88; cintura 64–68.',
      },
      {
        key: 'sizeGuide',
        label: 'Link do guia de tamanhos',
        hint: 'Caminho interno ou URL HTTPS.',
      },
    ],
  },
  {
    title: 'Dados fiscais e logística',
    fields: [
      { key: 'ncm', label: 'NCM (8 dígitos)' },
      { key: 'cest', label: 'CEST (7 dígitos)' },
      {
        key: 'origin',
        label: 'Origem fiscal',
        options: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
      },
      { key: 'unit', label: 'Unidade', options: ['UN', 'PC', 'CJ', 'PAR'] },
      { key: 'weight', label: 'Peso embalado (g)', type: 'number' },
      { key: 'length', label: 'Comprimento da embalagem (cm)', type: 'number' },
      { key: 'width', label: 'Largura da embalagem (cm)', type: 'number' },
      { key: 'height', label: 'Altura da embalagem (cm)', type: 'number' },
    ],
  },
  {
    title: 'SEO',
    fields: [
      { key: 'seoTitle', label: 'Título SEO', max: 70 },
      { key: 'seoDescription', label: 'Meta description', max: 160 },
      {
        key: 'canonical',
        label: 'Canonical',
        hint: 'Opcional. URL HTTPS da STUW; padrão: URL deste produto.',
      },
    ],
  },
  {
    title: 'Integração',
    fields: [
      { key: 'externalId', label: 'ID externo no ERP' },
      { key: 'source', label: 'Origem do dado', options: ['manual', 'olist', 'importacao'] },
    ],
  },
];
export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export function emptyProduct(): ProductDraft {
  return {
    name: '',
    slug: '',
    summary: '',
    description: '',
    highlights: '',
    brand: 'STUW',
    category: '',
    activityCategory: '',
    occasion: '',
    gender: '',
    collection: '',
    tags: '',
    fabric: '',
    composition: '',
    fit: '',
    waist: '',
    compression: '',
    support: '',
    care: '',
    technical: '',
    sizes: [],
    colors: [],
    price: null,
    comparePrice: null,
    cost: null,
    salePrice: null,
    saleStart: '',
    saleEnd: '',
    wholesalePrice: null,
    wholesaleMinimum: 1,
    wholesalePack: '',
    measurements: '',
    sizeGuide: '',
    ncm: '',
    cest: '',
    origin: '',
    unit: 'UN',
    weight: null,
    length: null,
    width: null,
    height: null,
    seoTitle: '',
    seoDescription: '',
    canonical: '',
    source: 'manual',
    externalId: '',
    status: 'draft',
    publishAt: '',
    featured: false,
    lastSync: '',
  };
}
export function fromLegacy(p: Product): ProductDraft {
  return {
    ...emptyProduct(),
    name: p.title,
    slug: p.slug,
    description: p.description,
    category: categories.some((c) => c.value === p.category) ? p.category : '',
    activityCategory: activityCategories.some((c) => c.value === p.activityCategory)
      ? p.activityCategory
      : '',
    collection: p.collection,
    occasion: p.occasion ?? '',
    fabric: p.fabric ?? '',
    fit: p.feelTag,
    price: p.price,
    featured: p.featured ?? false,
    sizes: p.sizes,
    colors: p.colors.map((c, i) => ({
      ...c,
      slug: slugify(c.name),
      swatch: '',
      active: true,
      price: null,
      images:
        i === 0
          ? [
              { src: p.image, alt: `${p.title} — frente`, role: 'frente' },
              ...(p.hoverImage
                ? [{ src: p.hoverImage, alt: `${p.title} — costas`, role: 'costas' as const }]
                : []),
              ...(p.galleryImages ?? []).map((m) => ({ ...m, role: 'detalhe' as const })),
            ]
          : [],
      skus: p.sizes.map((size) => ({
        size,
        code: `STUW-${p.id}-${i + 1}-${slugify(size).toUpperCase()}`,
        gtin: '',
        stock: 0,
        price: null,
        active: true,
      })),
    })),
  };
}
export function validGtin(value: string) {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = value.slice(0, -1).split('').reverse();
  const sum = digits.reduce((n, d, i) => n + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(value.at(-1));
}
export function validAsset(src: string) {
  return (
    /^\/products\/(?:[a-zA-Z0-9 _-]+\/)*[a-zA-Z0-9 _-]+\.(webp|png|jpe?g|avif)$/.test(src) ||
    /^\/api\/product-images\/[a-f0-9-]{36}\.(webp|png|jpg|avif)$/.test(src)
  );
}
const money = (n: unknown) =>
  n === null ||
  (typeof n === 'number' &&
    Number.isFinite(n) &&
    n >= 0 &&
    n <= 1000000 &&
    Math.abs(n * 100 - Math.round(n * 100)) < 0.000001);
const date = (s: string) => !s || (/^\d{4}-\d\d-\d\dT/.test(s) && Number.isFinite(Date.parse(s)));
export function validateProduct(value: unknown): string | null {
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > 200000)
    return 'Cadastro inválido ou muito grande.';
  const p = value as ProductDraft;
  for (const f of PRODUCT_SECTIONS.flatMap((s) => s.fields)) {
    const v = p[f.key];
    if (f.type === 'number') {
      if (!money(v)) return `${f.label}: informe um número positivo com até duas casas decimais.`;
    } else if (
      typeof v !== 'string' ||
      v.length > (f.max ?? (f.type === 'textarea' ? 10000 : 1000))
    )
      return `${f.label}: conteúdo inválido ou muito longo.`;
    if (f.options && v && !f.options.includes(String(v))) return `${f.label}: opção inválida.`;
    if (f.type === 'datetime-local' && !date(String(v))) return `${f.label}: data inválida.`;
  }
  if (!p.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) || p.slug.length > 160)
    return 'Informe nome e slug válido (letras minúsculas, números e hífens).';
  if (
    !['draft', 'active', 'inactive'].includes(p.status) ||
    typeof p.featured !== 'boolean' ||
    typeof p.publishAt !== 'string' ||
    !date(p.publishAt)
  )
    return 'Publicação inválida.';
  if (!Number.isInteger(p.wholesaleMinimum) || p.wholesaleMinimum < 1)
    return 'O mínimo de atacado deve ser um inteiro positivo.';
  if (p.comparePrice !== null && (p.price === null || p.comparePrice <= p.price))
    return 'O preço anterior deve ser maior que o preço de venda.';
  if (
    p.salePrice !== null &&
    (p.price === null ||
      p.salePrice >= p.price ||
      !p.saleStart ||
      !p.saleEnd ||
      Date.parse(p.saleEnd) <= Date.parse(p.saleStart))
  )
    return 'Promoção exige preço menor que o preço base e início anterior ao fim.';
  if (p.salePrice === null && (p.saleStart || p.saleEnd))
    return 'Informe o preço da promoção ou remova sua vigência.';
  if ((p.ncm && !/^\d{8}$/.test(p.ncm)) || (p.cest && !/^\d{7}$/.test(p.cest)))
    return 'Confira os dígitos do NCM e do CEST.';
  for (const n of [p.weight, p.length, p.width, p.height])
    if (n !== null && n <= 0) return 'Peso e dimensões devem ser maiores que zero.';
  if (p.canonical && !/^https:\/\/stuw\.vercel\.app\/produtos\/[a-z0-9-]+$/.test(p.canonical))
    return 'Canonical deve ser uma URL de produto da STUW.';
  if (p.sizeGuide && !/^(\/(?!\/)[^\s\\]*|https:\/\/[^\s]+)$/.test(p.sizeGuide))
    return 'Link do guia inválido.';
  if (p.composition) {
    const parts = p.composition
      .split(';')
      .map((s) => /^\s*[^:]+:\s*(\d+(?:[.,]\d+)?)\s*%?\s*$/.exec(s));
    if (
      parts.some((p) => !p) ||
      Math.abs(parts.reduce((n, p) => n + Number(p![1].replace(',', '.')), 0) - 100) > 0.01
    )
      return 'A composição deve ter material: percentual, separado por ponto e vírgula, somando 100%.';
  }
  if (
    p.technical &&
    p.technical.split('\n').some((line) => line.trim() && !/^[^:]+:\s*\S/.test(line))
  )
    return 'Ficha técnica: use chave: valor em cada linha.';
  if (
    !Array.isArray(p.sizes) ||
    p.sizes.some((s) => !PRODUCT_SIZES.includes(s as (typeof PRODUCT_SIZES)[number])) ||
    new Set(p.sizes).size !== p.sizes.length
  )
    return 'Grade de tamanhos inválida.';
  if (!Array.isArray(p.colors) || p.colors.length > 30) return 'Use até 30 cores por produto.';
  const names = new Set<string>(),
    slugs = new Set<string>(),
    codes = new Set<string>(),
    gtins = new Set<string>();
  for (const c of p.colors) {
    if (
      !c ||
      typeof c.name !== 'string' ||
      !c.name.trim() ||
      c.name.length > 80 ||
      typeof c.slug !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug) ||
      c.slug.length > 80 ||
      names.has(c.name.toLowerCase()) ||
      slugs.has(c.slug)
    )
      return 'Cada cor precisa de nome e slug únicos.';
    names.add(c.name.toLowerCase());
    slugs.add(c.slug);
    if (
      typeof c.active !== 'boolean' ||
      typeof c.hex !== 'string' ||
      (c.hex !== '' && !/^#[0-9a-fA-F]{6}$/.test(c.hex)) ||
      (!c.hex && !c.swatch) ||
      typeof c.swatch !== 'string' ||
      (c.swatch && !validAsset(c.swatch)) ||
      !money(c.price)
    )
      return `Confira a amostra e o preço da cor ${c.name}.`;
    if (
      !Array.isArray(c.images) ||
      c.images.length > 20 ||
      c.images.some(
        (m) =>
          !m ||
          !validAsset(m.src) ||
          typeof m.alt !== 'string' ||
          !m.alt.trim() ||
          m.alt.length > 200 ||
          !['frente', 'costas', 'detalhe', 'lifestyle'].includes(m.role),
      )
    )
      return `Imagens de ${c.name}: use arquivos permitidos e texto alternativo (até 200 caracteres).`;
    if (
      !Array.isArray(c.skus) ||
      c.skus.length > 6 ||
      new Set(c.skus.map((s) => s.size)).size !== c.skus.length
    )
      return `SKUs duplicados na cor ${c.name}.`;
    for (const s of c.skus) {
      if (
        !s ||
        !p.sizes.includes(s.size) ||
        typeof s.code !== 'string' ||
        !/^[A-Z0-9_-]{1,64}$/.test(s.code) ||
        codes.has(s.code) ||
        typeof s.active !== 'boolean' ||
        !Number.isInteger(s.stock) ||
        s.stock < 0 ||
        s.stock > 1000000 ||
        !money(s.price)
      )
        return `Confira SKU, tamanho, estoque e preço de ${c.name}.`;
      if (typeof s.gtin !== 'string' || (s.gtin && (!validGtin(s.gtin) || gtins.has(s.gtin))))
        return 'EAN/GTIN inválido ou duplicado.';
      codes.add(s.code);
      if (s.gtin) gtins.add(s.gtin);
    }
  }
  if (p.status === 'active') {
    if (
      !p.description.trim() ||
      !p.category ||
      !p.activityCategory ||
      !p.brand ||
      p.price === null ||
      p.price <= 0 ||
      !p.sizes.length
    )
      return 'Para publicar, preencha descrição, marca, classificação, preço positivo e tamanhos.';
    const active = p.colors.filter((c) => c.active);
    if (
      !active.length ||
      active.some(
        (c) => !c.images.some((m) => m.role === 'frente') || !c.skus.some((s) => s.active),
      )
    )
      return 'Cada cor ativa precisa de imagem de frente e pelo menos um SKU ativo.';
  }
  return null;
}
export function saleActive(p: ProductDraft, now = Date.now()) {
  return p.salePrice !== null && Date.parse(p.saleStart) <= now && now < Date.parse(p.saleEnd);
}
export function toStoreProduct(id: number, p: ProductDraft, now = Date.now()): Product {
  const colors = p.colors.filter((c) => c.active);
  const first = colors[0];
  const photo = first?.images.find((m) => m.role === 'frente') ?? first?.images[0];
  const base = saleActive(p, now) ? p.salePrice : p.price;
  const variants = colors.flatMap((c) =>
    c.skus
      .filter((s) => s.active)
      .map((s) => ({
        color: c.name,
        size: s.size,
        sku: s.code,
        gtin: s.gtin,
        stock: s.stock,
        price: s.price ?? c.price ?? base ?? 0,
      })),
  );
  return {
    id,
    title: p.name,
    slug: p.slug,
    category: p.category,
    collection: p.collection,
    activityCategory: p.activityCategory,
    fabric: (p.fabric || null) as Product['fabric'],
    occasion: (p.occasion || null) as Product['occasion'],
    featured: p.featured,
    feelTag: p.fit,
    description: p.description,
    price: variants.length ? Math.min(...variants.map((s) => s.price)) : base,
    badge: '',
    rating: 0,
    reviewsCount: 0,
    sizes: p.sizes,
    colors: colors.map((c) => ({
      name: c.name,
      hex: c.hex || '#E8E5DF',
      swatch: c.swatch || undefined,
    })),
    image: photo?.src ?? '',
    hoverImage: first?.images.find((m) => m.role === 'costas')?.src,
    galleryImages: first?.images,
    variants,
    colorMedia: Object.fromEntries(
      colors.map((c) => [
        c.name,
        [
          ...c.images.filter((m) => m.role === 'frente'),
          ...c.images.filter((m) => m.role !== 'frente'),
        ],
      ]),
    ),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription || p.summary,
    canonical: p.canonical,
    brand: p.brand,
    wholesaleMinimum: p.wholesaleMinimum,
    wholesalePack: p.wholesalePack,
    measurements: p.measurements,
    sizeGuide: p.sizeGuide,
    care: p.care,
    composition: p.composition,
    comparePrice: saleActive(p, now) ? p.price : p.comparePrice,
  };
}
