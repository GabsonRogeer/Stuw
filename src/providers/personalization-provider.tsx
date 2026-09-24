'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Product } from '@/types';
import { personalizationRepository as repository } from '@/repositories/personalization';
import { parsePersonalization, type PrivacyChoice } from '@/services/personalization';

type PersonalizationContextValue = {
  ready: boolean;
  choice: PrivacyChoice | null;
  products: Product[];
  recentProducts: Product[];
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  choose: (choice: PrivacyChoice) => void;
  recordView: (id: number) => void;
  clearHistory: () => void;
};
const Context = createContext<PersonalizationContextValue | null>(null);
const clientReady = () => true;
const serverReady = () => false;

export function PersonalizationProvider({
  products,
  children,
}: {
  products: Product[];
  children: ReactNode;
}) {
  const raw = useSyncExternalStore(
    repository.subscribe,
    repository.readSnapshot,
    repository.serverSnapshot,
  );
  const ready = useSyncExternalStore(repository.subscribe, clientReady, serverReady);
  const state = parsePersonalization(raw);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const productIds = useMemo(() => new Set(products.map((product) => product.id)), [products]);
  useEffect(() => {
    const prune = () => repository.prune(productIds);
    prune();
    const timer = window.setInterval(prune, 60_000);
    window.addEventListener('focus', prune);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', prune);
    };
  }, [productIds]);
  const recentProducts = state.views
    .map((view) => products.find((product) => product.id === view.productId))
    .filter((product): product is Product => Boolean(product));

  return (
    <Context.Provider
      value={{
        ready,
        choice: state.choice,
        products,
        recentProducts,
        settingsOpen,
        openSettings: () => setSettingsOpen(true),
        closeSettings: () => setSettingsOpen(false),
        choose: (choice) => {
          repository.choose(choice);
          setSettingsOpen(false);
        },
        recordView: repository.record,
        clearHistory: repository.clearHistory,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function usePersonalization() {
  const value = useContext(Context);
  if (!value) throw new Error('usePersonalization requires PersonalizationProvider');
  return value;
}
