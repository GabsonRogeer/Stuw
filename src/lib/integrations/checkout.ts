import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import {
  quoteContext,
  type QuoteRequest,
  type QuotedProduct,
} from '@/services/checkout-integration';
import { toCents, shippingStatus, type CheckoutPaymentResult } from '@/services/fulfillment';
import type { Order } from '@/types/database';
import { FREE_SHIPPING_THRESHOLD } from '@/lib/commerce';
import { commerceConfig, shippingConfig, requiredEnv } from './config';
import { calculateShipping, trackShipments } from './melhor-envio';
import { getPayment, findOrderPayments, type MercadoPayment } from './mercado-pago';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function quoteCheckout(userId: string, request: QuoteRequest, refresh = false) {
  const { production } = shippingConfig();
  const db = createServiceClient();
  // Bound provider traffic and keep quotes reusable for the same address and basket.
  const contextHash = hash(
    quoteContext(request) + ':' + process.env.MELHOR_ENVIO_ENVIRONMENT?.trim(),
  );
  const recent = await db
    .from('checkout_shipping_quotes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent.error) throw new Error('Não foi possível consultar o frete.');
  if (recent.data && Date.parse(recent.data.expires_at) > Date.now()) {
    if (!refresh && recent.data.context_hash === contextHash) return recent.data;
    if (Date.parse(recent.data.created_at) > Date.now() - 3000)
      throw new Error('Aguarde alguns segundos para recalcular o frete.');
  }
  const ids = [...new Set(request.items.map((item) => item.id))];
  const [editorial, published] = await Promise.all([
    db.from('admin_products').select('*').in('id', ids).is('deleted_at', null),
    db.from('catalog_products').select('*').in('id', ids),
  ]);
  if (editorial.error || published.error) throw new Error('Não foi possível conferir os produtos.');
  const products: QuotedProduct[] = request.items.map((item) => {
    const row = editorial.data.find((p) => p.id === item.id);
    const live = published.data.find((p) => p.id === item.id);
    if (
      !row ||
      row.document.status !== 'active' ||
      !live?.payload ||
      (live.publish_at && Date.parse(live.publish_at) > Date.now())
    )
      throw new Error(
        'Uma peça da sacola ainda não está disponível para compra. Entre em contato com a STUW.',
      );
    const document = row.document;
    if (production && document.shippingPackageIsTest)
      throw new Error(
        'As medidas de envio de uma peça ainda são de teste. Entre em contato com a STUW.',
      );
    const product =
      Date.parse(live.payload.saleStart) <= Date.now() &&
      Date.now() < Date.parse(live.payload.saleEnd)
        ? live.payload.promotion
        : live.payload.regular;
    const variant = product.variants?.find((v) => v.color === item.color && v.size === item.size);
    if (!variant?.sku || variant.stock < item.qty)
      throw new Error('Uma peça não tem estoque suficiente. Revise a sacola.');
    if (
      ![document.weight, document.width, document.height, document.length].every(
        (n) => typeof n === 'number' && Number.isFinite(n) && n > 0,
      )
    )
      throw new Error(
        'O frete de uma peça ainda não está configurado. Entre em contato com a STUW.',
      );
    return {
      ...item,
      sku: variant.sku,
      title: product.title,
      image: product.image,
      price_cents: toCents(variant.price),
      weight: document.weight!,
      width: document.width!,
      height: document.height!,
      length: document.length!,
    };
  });
  const quotedOptions = await calculateShipping(
    request.information.postalCode.replace(/\D/g, ''),
    products.map((p) => ({
      id: p.sku,
      weight: p.weight / 1000,
      width: p.width,
      height: p.height,
      length: p.length,
      insurance_value: p.price_cents / 100,
      quantity: p.qty,
    })),
  );
  const freeShipping =
    products.reduce((sum, p) => sum + p.price_cents * p.qty, 0) >= FREE_SHIPPING_THRESHOLD * 100;
  const options = quotedOptions.map((option, index) => ({
    ...option,
    carrierPrice: option.price,
    price: freeShipping && index === 0 ? 0 : option.price,
  }));
  if (!options.length)
    throw new Error(
      'Nenhuma entrega disponível para esse CEP e essa sacola. Entre em contato com a STUW.',
    );
  const result = await db
    .from('checkout_shipping_quotes')
    .insert({ user_id: userId, context_hash: contextHash, products, options })
    .select('*')
    .single();
  if (result.error) throw new Error('Não foi possível guardar a cotação. Tente novamente.');
  return result.data;
}

export async function applyPayment(payment: MercadoPayment) {
  const { production } = commerceConfig();
  const db = createServiceClient();
  const result = await db
    .from('orders')
    .select('*')
    .eq('id', payment.external_reference)
    .maybeSingle();
  const order = result.data;
  if (result.error || !order || order.is_demo)
    throw new Error('Pedido do pagamento não encontrado.');
  if (
    String(payment.collector_id) !== requiredEnv('MERCADO_PAGO_COLLECTOR_ID') ||
    payment.live_mode !== production ||
    payment.live_mode === order.payment_test_mode ||
    payment.currency_id !== 'BRL' ||
    toCents(payment.transaction_amount) !== order.total_cents ||
    (order.payment_method === 'pix'
      ? payment.payment_method_id !== 'pix'
      : payment.payment_type_id !== 'credit_card')
  )
    throw new Error('Pagamento divergente. Revisão necessária.');
  const status =
    payment.transaction_amount_refunded && payment.transaction_amount_refunded > 0
      ? 'refunded'
      : payment.status;
  const update = await db.rpc('apply_checkout_payment', {
    input_id: order.id,
    provider_id: String(payment.id),
    next_status: status,
    provider_time: payment.date_last_updated,
  });
  if (update.error) throw new Error('Não foi possível confirmar o pagamento.');
  return order.id;
}

export function paymentResult(order: Order, payment?: MercadoPayment): CheckoutPaymentResult {
  const pix = payment?.point_of_interaction?.transaction_data;
  return {
    id: order.id,
    code: order.number,
    total: order.total_cents / 100,
    paymentStatus: order.payment_status,
    testMode: order.payment_test_mode,
    ...(order.payment_method === 'pix' &&
    order.payment_status === 'pending' &&
    pix?.qr_code &&
    pix.qr_code_base64
      ? {
          pix: {
            code: pix.qr_code,
            image: pix.qr_code_base64,
            expiresAt: payment?.date_of_expiration ?? order.payment_expires_at ?? '',
          },
        }
      : {}),
  };
}

export async function syncOrderPayment(orderId: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from('order_integrations')
    .select('*')
    .eq('order_id', orderId)
    .single();
  if (error) throw new Error('Integração do pedido não encontrada.');
  if (data.payment_id?.startsWith('request-rejected:')) return undefined;
  const payments = data.payment_id
    ? [await getPayment(data.payment_id)]
    : await findOrderPayments(orderId);
  for (const payment of payments) {
    if (payment.external_reference !== orderId)
      throw new Error('Referência de pagamento divergente.');
    await applyPayment(payment);
  }
  const terminal = payments[0] && ['rejected', 'cancelled'].includes(payments[0].status);
  const interval = payments[0]?.status === 'approved' ? 60 * 60 * 1000 : 60000;
  await db
    .from('order_integrations')
    .update({
      last_synced_at: new Date().toISOString(),
      next_sync_at: terminal ? null : new Date(Date.now() + interval).toISOString(),
    })
    .eq('order_id', orderId);
  return payments[0];
}

export async function syncOrderShipment(orderId: string, labelId: string) {
  const rows = await trackShipments([labelId]);
  const row = rows[labelId];
  if (!row || row.id !== labelId)
    throw new Error('Etiqueta não encontrada nesta conta do Melhor Envio.');
  const result = await createServiceClient().rpc('apply_checkout_shipment', {
    input_id: orderId,
    input_label: labelId,
    next_status: shippingStatus(row),
    input_tracking: row.tracking ?? '',
  });
  if (result.error)
    throw new Error(
      'Não foi possível vincular ou atualizar a etiqueta. Confira se o pedido está pago e se a etiqueta já está vinculada.',
    );
}
