import {
  parsePersonalization,
  recordProductView,
  type PersonalizationState,
  type PrivacyChoice,
} from '../services/personalization';

const STORAGE_KEY = 'stuw_personalization_v1';
const CHANGE_EVENT = 'stuw-personalization-change';
let memory: string | null = null;
let memoryOnly = false;

// Browser adapter. A future authenticated API can replace persistence here.
function readSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  if (memoryOnly) return memory;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
}

function save(state: PersonalizationState) {
  const raw = JSON.stringify(state);
  if (raw === readSnapshot()) return;
  memory = raw;
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const personalizationRepository = {
  readSnapshot,
  serverSnapshot: () => null,
  subscribe(callback: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        memory = null;
        memoryOnly = false;
        callback();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, callback);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGE_EVENT, callback);
    };
  },
  choose(choice: PrivacyChoice) {
    const current = parsePersonalization(readSnapshot());
    save({
      version: 1,
      choice,
      chosenAt: Date.now(),
      views: choice === 'accepted' ? current.views : [],
    });
  },
  record(productId: number) {
    // Recheck persisted consent here, including changes made by another tab.
    const current = parsePersonalization(readSnapshot());
    const next = recordProductView(current, productId);
    if (next !== current) save(next);
  },
  clearHistory() {
    const current = parsePersonalization(readSnapshot());
    if (current.views.length) save({ ...current, views: [] });
  },
  prune(productIds: Set<number>) {
    const raw = readSnapshot();
    if (raw === null) return;
    const current = parsePersonalization(raw);
    save({ ...current, views: current.views.filter((view) => productIds.has(view.productId)) });
  },
};
