'use server';
import { createClient } from '@/lib/supabase/server';
import { quoteCheckout } from '@/lib/integrations/checkout';
import { isInformationValid } from '@/services/checkout';
import { validCheckoutLines, type QuoteRequest } from '@/services/checkout-integration';
import type { ShippingOption } from '@/services/shipping';

export async function getShippingQuotes(
  request: QuoteRequest,
  refresh = false,
): Promise<{ error?: string; quoteId?: string; expiresAt?: string; options?: ShippingOption[] }> {
  try {
    const db = await createClient();
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    if (error || !user) return { error: 'Entre na sua conta para consultar o frete.' };
    if (!request || !validCheckoutLines(request.items) || !isInformationValid(request.information))
      return { error: 'Confira o endereço e a sacola.' };
    const quote = await quoteCheckout(user.id, request, refresh === true);
    return { quoteId: quote.id, expiresAt: quote.expires_at, options: quote.options };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Não foi possível calcular o frete.' };
  }
}
