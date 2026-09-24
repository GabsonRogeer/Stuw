'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useCart } from '@/providers/cart-provider';
import { calculateTotals } from '@/lib/commerce';
import {
  EMPTY_INFORMATION,
  isInformationValid,
  isTaxDocumentValid,
  shippingContextKey,
  type CheckoutInformation,
  type PaymentMethod,
} from '@/services/checkout';
import { quoteShipping } from '@/services/shipping';

function useCheckoutState() {
  const { items, ready, coupon, clear } = useCart();
  const [information, setInformation] = useState<CheckoutInformation>(EMPTY_INFORMATION);
  const [informationSubmitted, setInformationSubmitted] = useState(false);
  const [selection, setSelection] = useState<{ id: string; context: string } | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [gift, setGift] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [taxDocument, setTaxDocument] = useState('');
  const [installments, setInstallments] = useState(1);
  const [order, setOrder] = useState<{ code: string; total: number } | null>(null);
  const informationValid = informationSubmitted && isInformationValid(information);
  const subtotal = calculateTotals(items).subtotal;
  const shippingOptions = quoteShipping({ postalCode: information.postalCode, subtotal });
  const context = shippingContextKey(information, items);
  const shipping =
    selection?.context === context
      ? shippingOptions.find((option) => option.id === selection.id)
      : undefined;
  const totals = calculateTotals(items, coupon, payment, gift && giftWrap, shipping?.price ?? 0);

  function submitInformation() {
    if (!isInformationValid(information)) return false;
    setInformationSubmitted(true);
    return true;
  }
  function completeDemo() {
    if (
      order ||
      !ready ||
      !items.length ||
      !informationValid ||
      !shipping ||
      !payment ||
      !isTaxDocumentValid(taxDocument)
    )
      return false;
    setOrder({
      code: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      total: totals.total,
    });
    setInformation(EMPTY_INFORMATION);
    setInformationSubmitted(false);
    setSelection(null);
    setTaxDocument('');
    setGift(false);
    setGiftWrap(false);
    setPayment(null);
    setInstallments(1);
    clear();
    return true;
  }
  return {
    ready,
    items,
    information,
    informationValid,
    submitInformation,
    updateInformation: (patch: Partial<CheckoutInformation>) =>
      setInformation((current) => ({ ...current, ...patch })),
    shippingOptions,
    shipping,
    selectShipping: (id: string) => {
      if (shippingOptions.some((option) => option.id === id)) setSelection({ id, context });
    },
    payment,
    setPayment,
    gift,
    setGift,
    giftWrap,
    setGiftWrap,
    taxDocument,
    setTaxDocument,
    installments,
    setInstallments,
    totals,
    order,
    completeDemo,
  };
}
const CheckoutContext = createContext<ReturnType<typeof useCheckoutState> | null>(null);
export function CheckoutProvider({ children }: { children: ReactNode }) {
  return <CheckoutContext.Provider value={useCheckoutState()}>{children}</CheckoutContext.Provider>;
}
export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) throw new Error('useCheckout requires CheckoutProvider');
  return context;
}
