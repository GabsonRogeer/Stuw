import { emptyProduct, type ProductDraft, type ProductMedia } from '@/services/product-admin';

// Approved catalog: three separate products per color; P/M/G confirmed by the owner.
// Unknown commercial/technical data remains empty and all entries remain drafts.
const colors = [
  {
    name: 'Azul',
    slug: 'azul',
    hex: '#A9C9E8',
    top: 'FIT-0068.jpg',
    short: 'detalhe1.jpg',
    pocket: 'detalhe2.jpg',
    poses: ['FIT-0055.jpg', 'FIT-0068.jpg'],
  },
  {
    name: 'Preto',
    slug: 'preto',
    hex: '#111111',
    top: 'FIT-0016.jpg',
    short: 'detalhe2.jpg',
    pocket: 'detalhe1.jpg',
    poses: ['FIT-0011.jpg', 'FIT-0016.jpg'],
  },
  {
    name: 'Branco',
    slug: 'branco',
    hex: '#F5F5F5',
    top: 'detalhe2.jpg',
    short: 'frente.jpg',
    pocket: 'detalhe1.jpg',
    poses: ['FIT-0087.jpg', 'FIT-0088.jpg'],
  },
  {
    name: 'Grafite',
    slug: 'grafite',
    hex: '#4B4B50',
    top: 'detalhe2.jpg',
    short: 'frente.jpg',
    pocket: 'detalhe1.jpg',
    poses: ['FIT-0113.jpg', 'FIT-0120.jpg'],
  },
  {
    name: 'Rosa',
    slug: 'rosa',
    hex: '#F2A7C3',
    top: 'detalhe2.jpg',
    short: 'frente.jpg',
    pocket: 'detalhe1.jpg',
    poses: ['FIT-0094.jpg', 'FIT-0100.jpg'],
  },
  {
    name: 'Vermelho',
    slug: 'vermelho',
    hex: '#FF4B3F',
    top: 'FIT-0042.jpg',
    short: 'detalhe2.jpg',
    pocket: 'detalhe1.jpg',
    poses: ['FIT-0027.jpg', 'FIT-0042.jpg'],
  },
  {
    name: 'Azul Marinho',
    slug: 'azul-marinho',
    hex: '#1B2A4A',
    top: 'detalhe1.jpg',
    short: 'detalhe2.jpg',
    pocket: null,
    poses: ['FIT-0136.jpg', 'FIT-0145.jpg'],
  },
];
const models = [
  {
    name: 'Top',
    slug: 'top',
    sku: 'TOP',
    category: 'Tops/Croppeds',
    price: 70,
    summary: (color: string) =>
      `Top cropped frente única na cor ${color}, com decote redondo e costas abertas.`,
    description: (color: string) =>
      `O Top Stuw ${color} é um cropped com modelagem frente única e decote redondo, que deixa as costas abertas. Tem acabamento liso e barra reta, e combina com o Short Stuw para formar um conjunto ou pode ser usado separado. Pensado para treinar e para usar no dia a dia.`,
    highlights:
      'Frente única com decote redondo\nCostas abertas\nModelagem cropped\nTecido liso sem estampa',
    fit: 'Cropped frente única',
    waist: '',
  },
  {
    name: 'Short',
    slug: 'short',
    sku: 'SHORT',
    category: 'Shorts',
    price: 80,
    summary: (color: string) =>
      `Short de cintura alta na cor ${color}, com camada externa fluida, shortinho interno e bolso.`,
    description: (color: string) =>
      `O Short Stuw ${color} tem cintura alta com cós largo e uma camada externa fluida sobreposta a um shortinho interno justo. O shortinho interno tem um bolso para guardar itens pequenos, como um gloss ou um cartão. As costas têm recorte em V com costuras aparentes. Combina com o Top Stuw da mesma cor para formar o Conjunto Stuw.`,
    highlights:
      'Cintura alta com cós largo\nCamada externa fluida sobre shortinho interno\nBolso interno\nRecorte em V nas costas',
    fit: 'Camada externa fluida sobre shortinho interno justo',
    waist: 'Alta',
  },
  {
    name: 'Conjunto',
    slug: 'conjunto',
    sku: 'CONJ',
    category: 'Conjuntos',
    price: 150,
    summary: (color: string) =>
      `Conjunto Stuw ${color}: top cropped frente única e short de cintura alta com shortinho interno e bolso.`,
    description: (color: string) =>
      `O Conjunto Stuw ${color} reúne o Top Stuw, um cropped frente única com decote redondo e costas abertas, e o Short Stuw, de cintura alta com camada externa fluida, shortinho interno e bolso. Os dois vêm na mesma cor, para um look completo.`,
    highlights:
      'Top cropped frente única com costas abertas\nShort de cintura alta com shortinho interno\nBolso interno no short\nDuas peças na mesma cor',
    fit: 'Top cropped e short com camada externa fluida',
    waist: 'Alta',
  },
];

export function createProductionProducts(): ProductDraft[] {
  return colors.flatMap((color) =>
    models.map((model) => {
      const name = `${model.name} Stuw ${color.name}`;
      const folder = `/products/stuw-${color.slug}/`;
      const media = (file: string, role: ProductMedia['role'], alt: string): ProductMedia => ({
        src: folder + file,
        role,
        alt,
      });
      const front =
        model.slug === 'top' ? color.top : model.slug === 'short' ? color.short : 'frente.jpg';
      const images: ProductMedia[] = [
        media(front, 'frente', `${name} visto de frente`),
        media('costas.jpg', 'costas', `${name} visto de costas`),
      ];
      if (model.slug !== 'top' && color.pocket)
        images.push(
          media(
            color.pocket,
            'detalhe',
            `Detalhe do bolso interno do ${model.slug === 'conjunto' ? 'short do ' : ''}${name}`,
          ),
        );
      if (model.slug === 'conjunto') {
        images.push(media('detalhe1.jpg', 'detalhe', `Detalhe do ${name}`));
        images.push(media('detalhe2.jpg', 'detalhe', `Acabamento do ${name}`));
      }
      for (const file of color.poses) images.push(media(file, 'lifestyle', `${name} em uso`));
      if (model.slug !== 'conjunto')
        images.push(
          media(
            'frente.jpg',
            'lifestyle',
            `${name} combinado com a outra peça da mesma cor; peças vendidas separadamente`,
          ),
        );
      return {
        ...emptyProduct(),
        name,
        slug: `${model.slug}-stuw-${color.slug}`,
        summary: model.summary(color.name.toLowerCase()),
        description: model.description(color.name.toLowerCase()),
        highlights: model.highlights,
        category: model.category,
        activityCategory: 'Activewear / Training',
        price: model.price,
        sizes: ['P', 'M', 'G'],
        fit: model.fit,
        waist: model.waist,
        colors: [
          {
            name: color.name,
            slug: color.slug,
            hex: color.hex,
            swatch: '',
            active: true,
            price: null,
            images: images.filter(
              (image, index) => images.findIndex((other) => other.src === image.src) === index,
            ),
            skus: ['P', 'M', 'G'].map((size) => ({
              size,
              code: `STUW-${model.sku}-${color.slug.toUpperCase()}-${size}`,
              gtin: '',
              stock: 0,
              price: null,
              active: true,
            })),
          },
        ],
      };
    }),
  );
}
