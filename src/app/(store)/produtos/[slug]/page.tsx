import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getProductBySlug, getProducts } from '@/services/product-service';
import { ProductDetails } from '@/components/product/ProductDetails/ProductDetails';
import { getComplementaryProduct } from '@/services/recommendations';

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = true;
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: 'Produto não encontrado' };
  return {
    title: product.seoTitle || product.title,
    description: product.seoDescription || product.description,
    alternates: {
      canonical: product.canonical || `https://stuw.vercel.app/produtos/${product.slug}`,
    },
  };
}
export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  if (product.slug !== (await params).slug) permanentRedirect(`/produtos/${product.slug}`);
  const related = getComplementaryProduct(await getProducts(), product);
  const url = `https://stuw.vercel.app/produtos/${product.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: product.image.startsWith('/')
      ? `https://stuw.vercel.app${product.image}`
      : product.image,
    brand: { '@type': 'Brand', name: product.brand || 'STUW' },
    url,
    offers: product.variants?.map((v) => ({
      '@type': 'Offer',
      sku: v.sku,
      price: v.price,
      priceCurrency: 'BRL',
      availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${url}?cor=${encodeURIComponent(v.color)}&tamanho=${v.size}`,
      itemOffered: {
        '@type': 'Product',
        name: product.title,
        color: v.color,
        size: v.size,
        sku: v.sku,
        ...(v.gtin ? { gtin: v.gtin } : {}),
      },
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <ProductDetails key={product.id} product={product} related={related} />
    </>
  );
}
