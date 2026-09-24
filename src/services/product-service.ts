import { cache } from 'react';
import { productRepository } from '@/repositories/products';

export const getProducts = cache(() => productRepository.list());
export const getProductBySlug = cache((slug: string) => productRepository.findBySlug(slug));
