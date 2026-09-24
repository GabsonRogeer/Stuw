import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug, getProducts } from '@/services/product-service';
import { ProductDetails } from '@/components/product/ProductDetails/ProductDetails';
import { getComplementaryProduct } from '@/services/recommendations';

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export async function generateStaticParams() {
  return (await getProducts()).map((product) => ({ slug: product.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: 'Produto não encontrado' };
  return { title: product.title, description: product.description };
}
export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const related = getComplementaryProduct(await getProducts(), product);
  return <ProductDetails key={product.id} product={product} related={related} />;
}
