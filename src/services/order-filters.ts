import { ORDER_LABELS } from './orders';

export function orderFilters(params: { q?: string; status?: string; mode?: string }) {
  return {
    q: (params.q ?? '')
      .replace(/[^\p{L}\p{N}@.\s-]/gu, '')
      .trim()
      .slice(0, 100),
    status: Object.hasOwn(ORDER_LABELS, params.status ?? '') ? params.status! : '',
    mode: ['demo', 'sandbox', 'live'].includes(params.mode ?? '') ? params.mode! : '',
  };
}
