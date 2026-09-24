import type { Metadata } from 'next';
import { CheckoutShipping } from '@/components/checkout/CheckoutShipping/CheckoutShipping';
export const metadata: Metadata = { title: 'Escolher frete' };
export default function ShippingPage() {
  return <CheckoutShipping />;
}
