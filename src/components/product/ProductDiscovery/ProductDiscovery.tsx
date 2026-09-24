'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ProductGrid } from '@/components/catalog/ProductGrid/ProductGrid';
import { usePersonalization } from '@/providers/personalization-provider';
import { recommendFromHistory } from '@/services/recommendations';

export function ProductViewTracker({ productId }: { productId: number }) {
  const { ready, choice, recordView } = usePersonalization();
  useEffect(() => {
    if (ready && choice === 'accepted') recordView(productId);
  }, [productId, ready, choice, recordView]);
  return null;
}

export function ProductDiscovery({ currentProductId }: { currentProductId?: number }) {
  const { ready, choice, products, recentProducts, clearHistory, openSettings } =
    usePersonalization();
  const recent = recentProducts.filter((product) => product.id !== currentProductId).slice(0, 4);
  const suggestions = recommendFromHistory(
    products,
    recentProducts.map((product) => product.id),
    currentProductId,
  );
  if (!ready && !currentProductId) return null;
  const showEmptyHistory = !currentProductId && !recent.length;
  if (!recent.length && !suggestions.length && !showEmptyHistory) return null;
  return (
    <div className="space-y-14 py-12 sm:py-16">
      {suggestions.length > 0 && (
        <section aria-label={currentProductId ? 'Você também pode gostar' : 'Sugestões para você'}>
          <h2 className="font-serif text-3xl mb-6">
            {currentProductId ? 'Você também pode gostar' : 'Sugestões para você'}
          </h2>
          <ProductGrid products={suggestions} prioritizeImages={false} />
        </section>
      )}
      {recent.length > 0 && (
        <section aria-label="Vistos recentemente">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="font-serif text-3xl">Vistos recentemente</h2>
            <button type="button" onClick={clearHistory} className="underline text-xs shrink-0">
              Limpar histórico
            </button>
          </div>
          <ProductGrid products={recent} prioritizeImages={false} />
        </section>
      )}
      {showEmptyHistory && (
        <section
          aria-label="Vistos recentemente"
          className="border-y border-stuw-border dark:border-stuw-borderDark py-8"
        >
          <h2 className="font-serif text-3xl mb-3">Vistos recentemente</h2>
          <p className="text-sm text-stuw-slate mb-4">
            {choice === 'accepted'
              ? 'Os produtos que você abrir aparecerão aqui. Suas próximas visitas também ajudam a personalizar as sugestões.'
              : 'Ative a personalização para lembrar os produtos vistos e receber sugestões neste navegador.'}
          </p>
          {choice === 'accepted' ? (
            <Link href="/produtos" className="underline text-xs">
              Explorar produtos
            </Link>
          ) : (
            <button type="button" onClick={openSettings} className="underline text-xs">
              Gerenciar personalização
            </button>
          )}
        </section>
      )}
    </div>
  );
}
