import type { Product } from '../types';

// The production catalog is managed in the database. Drafts must never be
// exposed through a static fallback, including when the database is unavailable.
export const PRODUCTS: Product[] = [];
