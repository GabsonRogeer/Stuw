import type { Metadata } from 'next';
import { CheckoutInformation } from '@/components/checkout/CheckoutInformation/CheckoutInformation';
export const metadata: Metadata = { title: 'Informações de entrega' };
export default function InformationPage() {
  return <CheckoutInformation />;
}
