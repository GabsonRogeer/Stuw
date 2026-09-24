import { PRODUCTS } from '@/data/products';
import type { Product } from '@/types';

export interface ProductRepository {
  list(): Promise<Product[]>;
  findBySlug(slug: string): Promise<Product | null>;
}
// Same repository/service boundary used in Evolane. Replace with the catalog API.
export const productRepository: ProductRepository = {
  async list() {
    return PRODUCTS;
  },
  async findBySlug(slug) {
    return PRODUCTS.find((product) => product.slug === slug) ?? null;
  },
};
