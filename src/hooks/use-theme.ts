'use client';

import { useEffect } from 'react';
import { usePersistentState } from './use-persistent-state';

const validate = (value: unknown): 'light' | 'dark' => (value === 'dark' ? 'dark' : 'light');
export function useTheme() {
  const [theme, setTheme] = usePersistentState<'light' | 'dark'>('stuw_theme', 'light', validate);
  const dark = theme === 'dark';
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return { dark, toggle: () => setTheme((theme) => (theme === 'dark' ? 'light' : 'dark')) };
}
