'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { commerceConfig, CheckoutConfigurationError } from '@/lib/integrations/config';
import { applyPayment, hash, paymentResult, syncOrderPayment } from '@/lib/integrations/checkout';
import { createPayment } from '@/lib/integrations/mercado-pago';
import { IntegrationError } from '@/lib/integrations/http';
import { quoteContext, validCheckoutLines } from '@/services/checkout-integration';
import { isUuid, validOrderRequest, type OrderRequest } from '@/services/orders';
import { assertControlledCheckout } from '@/services/controlled-checkout';
import type { CardPaymentData, CheckoutPaymentResult } from '@/services/fulfillment';

type Result = { error?: string; loginRequired?: boolean; order?: CheckoutPaymentResult };
export async function placeOrder(request: OrderRequest, card?: CardPaymentData): Promise<Result> {
  try {
    const session = await createClient();
    const {
      data: { user },
      error: authError,
    } = await session.auth.getUser();
    if (authError || !user)
      return { error: 'Entre na sua conta para continuar.', loginRequired: true };
    if (!validOrderRequest(request) || !validCheckoutLines(request.items))
      return { error: 'Revise os dados do pedido antes de continuar.' };
    assertControlledCheckout(user.id, request.items);
    const { production } = commerceConfig();
    const taxDocument = request.taxDocument.toUpperCase().replace(/[.\/\-\s]/g, '');
    if (
      request.payment === 'card' &&
      (!card ||
        !/^[a-zA-Z0-9_-]{10,200}$/.test(card.token) ||
        !/^[a-zA-Z0-9_-]{1,50}$/.test(card.payment_method_id) ||
        card.installments !== request.installments ||
        card.payer?.identification?.number?.replace(/[.\/\-\s]/g, '') !== taxDocument)
    )
      return { error: 'Confira os dados do cartão e o CPF/CNPJ informado no pagamento.' };
    const db = createServiceClient();
    const { key: _key, quoteId: _quote, taxDocument: _tax, ...safeRequest } = request;
    void _key;
    void _quote;
    void _tax;
    const fingerprint = hash(
      JSON.stringify([
        quoteContext(request),
        user.email,
        request.information.firstName.trim(),
        request.information.lastName.trim(),
        request.information.phone,
        taxDocument,
        request.payment,
        request.installments,
        request.gift,
        request.giftWrap,
        request.coupon.trim().toUpperCase(),
        request.expectedTotal,
      ]),
    );
    const paymentFingerprint = hash(
      JSON.stringify([
        request.payment,
        taxDocument,
        card?.token ?? '',
        card?.payment_method_id ?? 'pix',
        request.installments,
      ]),
    );
    const prior = await db
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('request_key', request.key)
      .maybeSingle();
    if (prior.error) return { error: 'Não foi possível consultar seus pedidos. Tente novamente.' };
    if (!prior.data) {
      const { data: quote, error } = await db
        .from('checkout_shipping_quotes')
        .select('*')
        .eq('id', request.quoteId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (
        error ||
        !quote ||
        quote.context_hash !==
          hash(quoteContext(request) + ':' + process.env.MELHOR_ENVIO_ENVIRONMENT?.trim()) ||
        Date.parse(quote.expires_at) <= Date.now()
      )
        return { error: 'A cotação expirou ou a sacola mudou. Volte ao frete e recalcule.' };
    }
    const { data: id, error } = await db.rpc('create_checkout_order', {
      input_user: user.id,
      request: { ...safeRequest, key: request.key, quoteId: request.quoteId, liveMode: production },
      fingerprint,
      payment_fingerprint: paymentFingerprint,
    });
    if (error || !id) {
      const messages: Record<string, string> = {
        'Total changed': 'Os preços mudaram. Atualize a sacola e recalcule o frete.',
        'Quote expired': 'A cotação expirou. Volte ao frete e recalcule.',
        'Checkout changed':
          'Esta tentativa pertence a outro pedido. Consulte suas compras antes de tentar novamente.',
        'Stock unavailable': 'Uma peça ficou sem estoque. Revise sua sacola.',
        'Coupon unavailable': 'O cupom não está mais disponível. Remova-o e confira o total.',
      };
      return {
        error:
          messages[error?.message ?? ''] ??
          'Não foi possível preparar o pedido. Confira a sacola e tente novamente.',
      };
    }
    const [orderRow, integration] = await Promise.all([
      db.from('orders').select('*').eq('id', id).eq('user_id', user.id).single(),
      db.from('order_integrations').select('*').eq('order_id', id).single(),
    ]);
    if (orderRow.error || integration.error)
      return { error: 'Pedido registrado. Consulte suas compras antes de tentar novamente.' };
    if (production && process.env.OLIST_ENABLED === 'true') {
      const fiscal = await db.rpc('prepare_olist_order', {
        input_id: id,
        input_user: user.id,
        input_document: taxDocument,
      });
      if (fiscal.error)
        return {
          error:
            'Não foi possível preparar os dados de faturamento. Tente novamente antes de pagar.',
        };
    }
    let payment;
    let creatingPayment = false;
    try {
      if (
        integration.data.payment_id ||
        integration.data.payment_fingerprint !== paymentFingerprint ||
        orderRow.data.payment_status !== 'initializing'
      ) {
        payment = await syncOrderPayment(id);
      } else {
        creatingPayment = true;
        payment = await createPayment(orderRow.data, taxDocument, card);
        await applyPayment(payment);
      }
    } catch (failure) {
      if (failure instanceof IntegrationError) {
        console.warn('[checkout.payment]', {
          operation: creatingPayment ? 'create' : 'reconcile',
          httpStatus: failure.status,
          codes: failure.codes ?? [],
        });
      }
      if (
        creatingPayment &&
        failure instanceof IntegrationError &&
        [400, 401, 403, 404, 422].includes(failure.status) &&
        orderRow.data.payment_status === 'initializing' &&
        !integration.data.payment_id
      ) {
        // An explicit request rejection is different from an ambiguous network timeout.
        const cancelled = await db.rpc('apply_checkout_payment', {
          input_id: id,
          provider_id: `request-rejected:${id}`,
          next_status: 'rejected',
          provider_time: new Date().toISOString(),
        });
        if (!cancelled.error) {
          const diagnostic = !production
            ? `${[401, 403].includes(failure.status) ? ' A credencial não foi autorizada para esta operação; confira a aplicação e o ambiente no painel do Mercado Pago.' : ''} Diagnóstico de teste: HTTP ${failure.status}; código ${(failure.codes ?? []).join(', ') || 'não informado'}.`
            : '';
          return {
            order: {
              ...paymentResult({ ...orderRow.data, payment_status: 'rejected' }),
              paymentIssue: {
                kind: 'request_rejected',
                message:
                  'O Mercado Pago não aceitou a solicitação de pagamento. Nenhuma cobrança foi confirmada.' +
                  diagnostic,
              },
            },
          };
        }
      }
      // A timeout does not prove failure. Retain the order and reconcile before any new attempt.
      return {
        order: paymentResult(orderRow.data),
        error: 'Pedido registrado. Estamos conferindo o pagamento; acompanhe a confirmação abaixo.',
      };
    }
    const confirmed = await db.from('orders').select('*').eq('id', id).single();
    if (confirmed.error)
      return {
        order: paymentResult(orderRow.data),
        error: 'A confirmação será atualizada em instantes.',
      };
    revalidatePath('/conta/compras');
    revalidatePath('/admin/pedidos');
    revalidatePath('/produtos');
    return { order: paymentResult(confirmed.data, payment) };
  } catch (failure) {
    if (failure instanceof CheckoutConfigurationError) {
      // Never log the request, document, card token, credential values or provider payloads.
      console.warn('[checkout.configuration]', { code: failure.code, fields: failure.fields });
      return { error: failure.message };
    }
    console.warn('[checkout.unavailable]', { code: 'UNEXPECTED_CHECKOUT_FAILURE' });
    return { error: 'Pagamento indisponível no momento. Sua sacola foi mantida. Tente novamente.' };
  }
}

export async function checkOrderPayment(id: string): Promise<Result> {
  if (!isUuid(id)) return { error: 'Pedido inválido.' };
  try {
    const session = await createClient();
    const {
      data: { user },
      error,
    } = await session.auth.getUser();
    if (error || !user)
      return { loginRequired: true, error: 'Entre na sua conta para acompanhar o pagamento.' };
    const owned = await session
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (owned.error || !owned.data || owned.data.is_demo)
      return { error: 'Pedido não encontrado.' };
    const db = createServiceClient();
    const integration = await db.from('order_integrations').select('*').eq('order_id', id).single();
    if (integration.error) return { error: 'Não foi possível consultar o pagamento.' };
    let payment;
    if (
      Date.parse(integration.data.last_synced_at) < Date.now() - 15000 &&
      !['rejected', 'cancelled', 'refunded', 'charged_back'].includes(owned.data.payment_status)
    ) {
      const claimed = await db
        .from('order_integrations')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('order_id', id)
        .eq('last_synced_at', integration.data.last_synced_at)
        .select('order_id')
        .maybeSingle();
      if (claimed.data) payment = await syncOrderPayment(id);
    }
    const order = await session
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (order.error) return { error: 'Não foi possível atualizar o pedido.' };
    const result = paymentResult(order.data, payment);
    if (integration.data.payment_id?.startsWith('request-rejected:')) {
      result.paymentIssue = {
        kind: 'request_rejected',
        message:
          'O Mercado Pago não aceitou a solicitação desta tentativa. Nenhuma cobrança foi confirmada.',
      };
    }
    return { order: result };
  } catch {
    return {
      error: 'Não foi possível atualizar agora. O pedido continua disponível em suas compras.',
    };
  }
}
