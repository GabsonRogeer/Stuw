import type { Metadata } from 'next';
import { CheckoutPayment } from '@/components/checkout/CheckoutPayment/CheckoutPayment';
export const metadata: Metadata = { title: 'Pagamento' };
export default function PaymentPage() {
  return <CheckoutPayment />;
}
