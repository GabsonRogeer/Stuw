'use client';
import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { usePersistentState } from '@/hooks/use-persistent-state';
import {
  restoreWholesale,
  wholesaleKey,
  type WholesaleLine,
  type WholesaleProduct,
} from '@/services/wholesale';
function useWholesaleState(products: WholesaleProduct[]) {
  const validate = useCallback((value: unknown) => restoreWholesale(value, products), [products]);
  const [items, setItems, ready] = usePersistentState<WholesaleLine[]>(
    'stuw-wholesale-v1',
    [],
    validate,
  );
  return {
    items,
    ready,
    count: items.reduce((sum, i) => sum + i.qty, 0),
    add: (product: WholesaleProduct, size: string, color: string, qty: number) => {
      if (
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > 9999 ||
        !product.sizes.includes(size) ||
        !product.colors.some((c) => c.name === color)
      )
        return false;
      const line = { id: product.id, title: product.title, image: product.image, size, color, qty };
      const prior = items.find((i) => wholesaleKey(i) === wholesaleKey(line));
      if ((!prior && items.length >= 50) || (prior && prior.qty + qty > 9999)) return false;
      setItems((current) => {
        const match = current.find((i) => wholesaleKey(i) === wholesaleKey(line));
        if (match)
          return current.map((i) =>
            wholesaleKey(i) === wholesaleKey(line) ? { ...i, qty: Math.min(9999, i.qty + qty) } : i,
          );
        return current.length < 50 ? [...current, line] : current;
      });
      return true;
    },
    change: (key: string, qty: number) => {
      if (Number.isInteger(qty) && qty >= 1 && qty <= 9999)
        setItems((current) => current.map((i) => (wholesaleKey(i) === key ? { ...i, qty } : i)));
    },
    remove: (key: string) => setItems((current) => current.filter((i) => wholesaleKey(i) !== key)),
    clear: () => setItems([]),
  };
}
const WholesaleContext = createContext<ReturnType<typeof useWholesaleState> | null>(null);
export function WholesaleProvider({
  products,
  children,
}: {
  products: WholesaleProduct[];
  children: ReactNode;
}) {
  return (
    <WholesaleContext.Provider value={useWholesaleState(products)}>
      {children}
    </WholesaleContext.Provider>
  );
}
export function useWholesale() {
  const value = useContext(WholesaleContext);
  if (!value) throw new Error('WholesaleProvider required');
  return value;
}
