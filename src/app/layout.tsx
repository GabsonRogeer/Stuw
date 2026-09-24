import type { Metadata } from 'next';
import { AppProviders } from '@/providers/app-providers';
import { getProducts } from '@/services/product-service';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'STUW — Activewear & Wellness', template: '%s | STUW' },
  description:
    'A precisão do movimento. O luxo da pausa. Conheça a coleção de activewear e wellness da STUW.',
  icons: { icon: '/logo.jpg' },
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const products = await getProducts();
  return (
    <html lang="pt-BR">
      <body className="selection:bg-stuw-sage selection:text-white min-h-screen">
        <AppProviders products={products}>{children}</AppProviders>
      </body>
    </html>
  );
}
