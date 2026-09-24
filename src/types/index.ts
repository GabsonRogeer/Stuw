export interface ProductColor {
  name: string;
  hex: string;
}

export interface ProductImage {
  src: string;
  alt: string;
}

export interface Product {
  id: number;
  slug: string;
  title: string;
  category: string;
  collection: string;
  activityCategory: string;
  featured?: boolean;
  fabric: 'SilkAir' | 'SculptHold' | 'VelvetNulu' | 'ShieldAir';
  feelTag: string;
  occasion:
    | 'Studio & Mindful'
    | 'High Impact'
    | 'Racquet Club'
    | 'Street & Travel'
    | 'Recovery & Lounge';
  price: number;
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
