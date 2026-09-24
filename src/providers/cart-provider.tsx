'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { addCartItem, calculateTotals, itemKey, restoreCart } from '@/lib/commerce';
import type { CartItem, Product } from '@/types';

function useCartState(products: Product[]) {
  const validateCart = useCallback((value: unknown) => restoreCart(value, products), [products]);
  const [items, setItems, ready] = usePersistentState<CartItem[]>('stuw_cart', [], validateCart);
  const [coupon, setCoupon] = useState('');
  const addItem = (product: Product, size: string, color = product.colors[0].name) =>
    setItems((items) => addCartItem(items, product, size, color));
  const changeQuantity = (key: string, delta: number) =>
    setItems((items) =>
      items
        .map((item) =>
          itemKey(item) === key ? { ...item, qty: Math.min(99, item.qty + delta) } : item,
        )
        .filter((item) => item.qty > 0),
    );
  const removeItem = (key: string) =>
    setItems((items) => items.filter((item) => itemKey(item) !== key));
  const clear = () => {
    setItems([]);
    setCoupon('');
  };
  return {
    items,
    ready,
    coupon,
    setCoupon,
    addItem,
    changeQuantity,
    removeItem,
    clear,
    count: items.reduce((sum, item) => sum + item.qty, 0),
    totals: calculateTotals(items, coupon),
  };
}
const CartContext = createContext<ReturnType<typeof useCartState> | null>(null);
export function CartProvider({ children, products }: { children: ReactNode; products: Product[] }) {
  return <CartContext.Provider value={useCartState(products)}>{children}</CartContext.Provider>;
}
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart requires CartProvider');
  return context;
}
