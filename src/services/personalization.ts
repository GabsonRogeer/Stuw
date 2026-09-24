export const HISTORY_LIMIT = 20;
export const HISTORY_TTL = 30 * 24 * 60 * 60 * 1000;
export const CONSENT_TTL = 180 * 24 * 60 * 60 * 1000;

export type PrivacyChoice = 'accepted' | 'rejected';
export type ProductView = { productId: number; viewedAt: number };
export type PersonalizationState = {
  version: 1;
  choice: PrivacyChoice | null;
  chosenAt: number;
  views: ProductView[];
};

export function emptyPersonalization(): PersonalizationState {
  return { version: 1, choice: null, chosenAt: 0, views: [] };
}

export function parsePersonalization(raw: string | null, now = Date.now()): PersonalizationState {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (
      !value ||
      value.version !== 1 ||
      !['accepted', 'rejected'].includes(value.choice) ||
      !Number.isFinite(value.chosenAt) ||
      value.chosenAt > now ||
      now - value.chosenAt >= CONSENT_TTL
    )
      return emptyPersonalization();

    const seen = new Set<number>();
    const views: ProductView[] =
      value.choice === 'accepted' && Array.isArray(value.views)
        ? value.views
            .filter(
              (view: ProductView) =>
                view &&
                Number.isInteger(view.productId) &&
                view.productId > 0 &&
                Number.isFinite(view.viewedAt) &&
                view.viewedAt <= now &&
                now - view.viewedAt < HISTORY_TTL,
            )
            .sort((a: ProductView, b: ProductView) => b.viewedAt - a.viewedAt)
            .filter((view: ProductView) => {
              if (seen.has(view.productId)) return false;
              seen.add(view.productId);
              return true;
            })
            .slice(0, HISTORY_LIMIT)
            .map((view: ProductView) => ({ productId: view.productId, viewedAt: view.viewedAt }))
        : [];
    return { version: 1, choice: value.choice, chosenAt: value.chosenAt, views };
  } catch {
    return emptyPersonalization();
  }
}

export function recordProductView(
  state: PersonalizationState,
  productId: number,
  now = Date.now(),
): PersonalizationState {
  if (
    state.choice !== 'accepted' ||
    now - state.chosenAt >= CONSENT_TTL ||
    !Number.isInteger(productId) ||
    productId <= 0
  )
    return state;
  return {
    ...state,
    views: [
      { productId, viewedAt: now },
      ...state.views.filter(
        (view) => view.productId !== productId && now - view.viewedAt < HISTORY_TTL,
      ),
    ].slice(0, HISTORY_LIMIT),
  };
}
