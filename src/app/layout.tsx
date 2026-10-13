import type { Metadata } from 'next';
import { AppProviders } from '@/providers/app-providers';
import { getProducts } from '@/services/product-service';
import { getCategoryNavigation } from '@/repositories/categories';
import { CategoriesProvider } from '@/providers/categories-provider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'STUW — Activewear & Wellness', template: '%s | STUW' },
  description:
    'A precisão do movimento. O luxo da pausa. Conheça a coleção de activewear e wellness da STUW.',
  icons: { icon: '/logo.jpg' },
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [products, navigation] = await Promise.all([getProducts(), getCategoryNavigation()]);
  return (
    <html lang="pt-BR">
      <body className="selection:bg-stuw-sage selection:text-white min-h-screen">
        <CategoriesProvider navigation={navigation}>
          <AppProviders products={products}>{children}</AppProviders>
        </CategoriesProvider>
      </body>
    </html>
  );
}
