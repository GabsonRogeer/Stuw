import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { commerceConfig, requiredEnv } from './config';
import { integrationRequest } from './http';
import type { CardPaymentData } from '@/services/fulfillment';
import type { Order } from '@/types/database';

export type MercadoPayment = {
  id: number;
  external_reference: string;
  status: string;
  status_detail: string;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  currency_id: string;
  collector_id: number;
  live_mode: boolean;
  payment_method_id: string;
  payment_type_id: string;
  date_last_updated: string;
  date_of_expiration?: string;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
};
function request<T>(path: string, init: RequestInit = {}) {
  return integrationRequest<T>('Mercado Pago', `https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requiredEnv('MERCADO_PAGO_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}
function paymentExpiration(value: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime()))
    throw new Error('Validade do pagamento indisponível.');
  // Postgres returns microseconds; Payments accepts milliseconds and an explicit offset.
  // Format the persisted instant without calculating a new deadline on retries.
  return date.toISOString().replace('Z', '+00:00');
}
export async function createPayment(order: Order, taxDocument: string, card?: CardPaymentData) {
  const { origin, localTest } = commerceConfig();
  if (order.payment_method === 'card') {
    const methods = await request<{ id: string; payment_type_id: string }[]>('/v1/payment_methods');
    if (
      !card ||
      !methods.some((m) => m.id === card.payment_method_id && m.payment_type_id === 'credit_card')
    )
      throw new Error('Selecione um cartão de crédito válido.');
  }
  return request<MercadoPayment>('/v1/payments', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': order.id },
    body: JSON.stringify({
      transaction_amount: order.total_cents / 100,
      description: `Pedido STUW ${order.number}`,
      external_reference: order.id,
      ...(localTest ? {} : { notification_url: `${origin}/api/webhooks/mercado-pago` }),
      payment_method_id: order.payment_method === 'pix' ? 'pix' : card!.payment_method_id,
      installments: order.payment_method === 'pix' ? 1 : order.installments,
      ...(order.payment_method === 'card'
        ? { token: card!.token, issuer_id: card!.issuer_id }
        : { date_of_expiration: paymentExpiration(order.payment_expires_at) }),
      payer: {
        email: order.customer_email,
        identification: { type: taxDocument.length === 11 ? 'CPF' : 'CNPJ', number: taxDocument },
      },
      additional_info: {
        items: order.items.map((item) => ({
          id: String(item.id),
          title: item.title,
          quantity: item.qty,
          unit_price: item.price_cents / 100,
        })),
      },
    }),
  });
}
export const getPayment = (id: string) => {
  if (!/^\d{1,30}$/.test(id)) throw new Error('Pagamento inválido.');
  return request<MercadoPayment>(`/v1/payments/${id}`);
};
export async function findOrderPayments(id: string) {
  const result = await request<{ results: MercadoPayment[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(id)}&sort=date_created&criteria=desc&limit=10`,
  );
  return result.results;
}
export function validPaymentSignature(headers: Headers, id: string, now = Date.now()) {
  const signature = headers.get('x-signature') ?? '';
  const requestId = headers.get('x-request-id');
  const parts = Object.fromEntries(signature.split(',').map((part) => part.trim().split('=')));
  if (
    !requestId ||
    !/^\d{1,30}$/.test(id) ||
    !/^\d{10,13}$/.test(parts.ts ?? '') ||
    !/^[a-f0-9]{64}$/i.test(parts.v1 ?? '')
  )
    return false;
  const timestamp = Number(parts.ts) * (parts.ts.length === 10 ? 1000 : 1);
  if (Math.abs(now - timestamp) > 10 * 60 * 1000) return false;
  const expected = createHmac('sha256', requiredEnv('MERCADO_PAGO_WEBHOOK_SECRET'))
    .update(`id:${id};request-id:${requestId};ts:${parts.ts};`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, 'hex'));
}
