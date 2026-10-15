import type { Product } from '@/types';

export type CompleteLookSettings = {
  id: string;
  enabled: boolean;
  product_id: number | null;
  image: string;
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  button_label: string;
  revision: number;
  updated_at: string;
};
export const defaultCompleteLook: CompleteLookSettings = {
  id: 'home',
  enabled: true,
  product_id: null,
  image: '',
  eyebrow: 'Seu look completo',
  title: 'Juntos no',
  accent: 'seu ritmo.',
  description:
    'Top e short na mesma cor. Duas peças que se completam, com liberdade para combinar do seu jeito.',
  button_label: 'Ver conjunto',
  revision: 1,
  updated_at: '',
};
export function completeLookProducts(products: Product[]) {
  return products.filter((p) => p.category === 'Conjuntos' && p.price !== null && p.image);
}
export function completeLookProduct(products: Product[], settings: CompleteLookSettings) {
  const sets = completeLookProducts(products);
  return settings.product_id === null
    ? (sets.find((p) => p.featured) ?? sets[0])
    : sets.find((p) => p.id === settings.product_id);
}
export function completeLookImages(product: Product) {
  return [
    ...new Set(
      [
        product.image,
        ...(product.galleryImages ?? []).map((image) => image.src),
        ...Object.values(product.colorMedia ?? {})
          .flat()
          .map((image) => image.src),
      ].filter(Boolean),
    ),
  ];
}
export function validateCompleteLook(settings: CompleteLookSettings, products: Product[]) {
  for (const [field, max] of [
    ['eyebrow', 60],
    ['title', 80],
    ['accent', 80],
    ['description', 300],
    ['button_label', 40],
  ] as const) {
    if (!settings[field].trim() || settings[field].length > max)
      return 'Preencha os textos respeitando os limites de caracteres.';
  }
  if (
    settings.product_id !== null &&
    (!Number.isSafeInteger(settings.product_id) || settings.product_id < 1)
  )
    return 'Selecione um conjunto válido.';
  if (!settings.enabled) return null;
  const product = completeLookProduct(products, settings);
  if (settings.enabled && !product) return 'Selecione um conjunto publicado com preço e foto.';
  if (settings.image && (!product || !completeLookImages(product).includes(settings.image)))
    return 'Escolha uma foto da galeria do conjunto selecionado.';
  if (settings.product_id === null && settings.image)
    return 'No modo automático, use a foto principal do produto.';
  return null;
}
