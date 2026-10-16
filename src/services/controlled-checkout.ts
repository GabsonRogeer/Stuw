// Optional server-side scope for a controlled sale. Empty product list preserves normal sales.
export function assertControlledCheckout(userId: string, items: { id: number }[]) {
  const raw = process.env.CONTROLLED_PRODUCT_IDS?.trim();
  if (!raw) return;
  const productIds = raw.split(',').map((id) => Number(id.trim()));
  if (productIds.some((id) => !Number.isSafeInteger(id) || id <= 0))
    throw new Error('Configuração da venda controlada indisponível.');
  if (!items.some((item) => productIds.includes(item.id))) return;
  const allowed = (process.env.CONTROLLED_BUYER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!allowed.includes(userId))
    throw new Error('Este produto está reservado para uma compra controlada.');
}
