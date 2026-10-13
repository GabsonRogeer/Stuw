'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { CategoryNavigation } from '@/services/categories';

const CategoriesContext = createContext<CategoryNavigation | null>(null);
export function CategoriesProvider({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation: CategoryNavigation;
}) {
  return <CategoriesContext.Provider value={navigation}>{children}</CategoriesContext.Provider>;
}
export function useCategories() {
  const value = useContext(CategoriesContext);
  if (!value) throw new Error('useCategories requires CategoriesProvider');
  return value;
}
