'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type Panel =
  | 'cart'
  | 'search'
  | 'wishlist'
  | 'fit'
  | 'concierge'
  | 'returns'
  | 'newsletter'
  | null;
const StorefrontContext = createContext<{ panel: Panel; setPanel: (panel: Panel) => void } | null>(
  null,
);
export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  return (
    <StorefrontContext.Provider value={{ panel, setPanel }}>{children}</StorefrontContext.Provider>
  );
}
export function useStorefront() {
  const context = useContext(StorefrontContext);
  if (!context) throw new Error('useStorefront requires StorefrontProvider');
  return context;
}
