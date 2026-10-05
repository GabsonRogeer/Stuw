export interface ProductColor {
  name: string;
  hex: string;
  swatch?: string;
}

export interface ProductImage {
  src: string;
  alt: string;
}

export interface Product extends ManagedProductFields {
  id: number;
  slug: string;
  title: string;
  category: string;
  collection: string;
  activityCategory: string;
  featured?: boolean;
  fabric: 'SilkAir' | 'SculptHold' | 'VelvetNulu' | 'ShieldAir' | null;
  feelTag: string;
  occasion:
    | 'Studio & Mindful'
    | 'High Impact'
    | 'Racquet Club'
    | 'Street & Travel'
    | 'Recovery & Lounge'
    | null;
  /** Null means the product is visible but not available for purchase. */
  price: number | null;
  badge: string;
  rating: number;
  reviewsCount: number;
  image: string;
  /** Optional reverse view, supplied by the catalog repository (local path or remote URL). */
  hoverImage?: string;
  /** Additional gallery photos, ordered by the catalog repository. */
  galleryImages?: ProductImage[];
  description: string;
  colors: ProductColor[];
  sizes: string[];
}

export interface CartItem {
  id: number;
  title: string;
  price: number;
  image: string;
  color: string;
  size: string;
  qty: number;
}

export interface ManagedProductFields {
  wholesaleMinimum?: number;
  wholesalePack?: string;
  variants?: {
    color: string;
    size: string;
    sku: string;
    gtin: string;
    stock: number;
    price: number;
  }[];
  colorMedia?: Record<string, ProductImage[]>;
  seoTitle?: string;
  seoDescription?: string;
  canonical?: string;
  brand?: string;
  measurements?: string;
  sizeGuide?: string;
  care?: string;
  composition?: string;
  comparePrice?: number | null;
}
