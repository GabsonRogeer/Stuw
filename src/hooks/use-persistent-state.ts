'use client';

import { useCallback, useMemo, useState, useSyncExternalStore, type SetStateAction } from 'react';

const fallback = new Map<string, string>();
const changeEvent = 'stuw-storage-change';
const serverSnapshot = () => null;
const clientReady = () => true;
const serverReady = () => false;
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key) fallback.delete(event.key);
    else fallback.clear();
    callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(changeEvent, callback);
  };
}
function read(key: string) {
  if (fallback.has(key)) return fallback.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return fallback.get(key) ?? null;
  }
}

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  validate: (value: unknown) => T,
) {
  const [initial] = useState(initialValue);
  const snapshot = useCallback(() => read(key), [key]);
  const stored = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const decode = useCallback(
    (raw: string | null) => {
      if (raw === null) return initial;
      try {
        return validate(JSON.parse(raw));
      } catch {
        return initial;
      }
    },
    [initial, validate],
  );
  const value = useMemo(() => decode(stored), [decode, stored]);
  const setValue = useCallback(
    (action: SetStateAction<T>) => {
      const current = decode(read(key));
      const next = typeof action === 'function' ? (action as (value: T) => T)(current) : action;
      const serialized = JSON.stringify(next);
      fallback.set(key, serialized);
      try {
        localStorage.setItem(key, serialized);
      } catch {
        /* Keep the in-memory state when persistence is unavailable. */
      }
      window.dispatchEvent(new Event(changeEvent));
    },
    [decode, key],
  );
  return [value, setValue, ready] as const;
}
