'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { usePersistentState } from '@/hooks/use-persistent-state';

const validate = (value: unknown): number[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value.filter(
            (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0,
          ),
        ),
      )
    : [];
const WishlistContext = createContext<{ ids: number[]; toggle: (id: number) => void } | null>(null);
export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = usePersistentState<number[]>('stuw_wishlist', [], validate);
  const toggle = (id: number) =>
    setIds((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  return <WishlistContext.Provider value={{ ids, toggle }}>{children}</WishlistContext.Provider>;
}
export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist requires WishlistProvider');
  return context;
}
