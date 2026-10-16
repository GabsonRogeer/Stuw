import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import type { Order } from '@/types/database';
import type { InvoiceGenerationHistory } from '@/services/order-history';

// The caller must first load the order through the authenticated customer client.
// Never accept an order object or viewer identity from a form or request body.
export async function loadOwnedInvoiceGeneration(
  order: Pick<Order, 'id' | 'user_id' | 'is_demo' | 'payment_test_mode'>,
  viewerId: string,
): Promise<{ data: InvoiceGenerationHistory | null; error: boolean }> {
  if (!viewerId || order.user_id !== viewerId) return { data: null, error: true };
  if (order.is_demo || order.payment_test_mode) return { data: null, error: false };
  try {
    const result = await createServiceClient()
      .from('olist_invoice_jobs')
      .select('order_id,invoice_id,generate_attempted_at')
      .eq('order_id', order.id)
      .maybeSingle();
    return { data: result.error ? null : result.data, error: Boolean(result.error) };
  } catch {
    // A fiscal read failure must not prevent access to the purchase itself.
    return { data: null, error: true };
  }
}
