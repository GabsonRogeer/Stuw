import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckoutForm } from '@/components/checkout/CheckoutForm/CheckoutForm';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };
export default function CheckoutPage() {
  return (
    <>
      <header className="text-center border-b border-stuw-border dark:border-stuw-borderDark py-7">
        <Link href="/" className="text-3xl tracking-[.25em]">
          STUW
        </Link>
      </header>
      <main className="page-container py-10 sm:py-16">
        <CheckoutForm />
      </main>
    </>
  );
}
