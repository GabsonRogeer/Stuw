'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { placeOrder, checkOrderPayment } from '@/app/actions/order';
import { useCart } from '@/providers/cart-provider';
import { calculateTotals } from '@/lib/commerce';
import {
  isInformationValid,
  isTaxDocumentValid,
  shippingContextKey,
  type CheckoutInformation,
  type PaymentMethod,
} from '@/services/checkout';
import type { ShippingOption } from '@/services/shipping';
import { getShippingQuotes } from '@/app/actions/shipping';
import type { CardPaymentData, CheckoutPaymentResult } from '@/services/fulfillment';
import {
  applyCheckoutAddress,
  initialCheckoutInformation,
  type CheckoutAddress,
  type CheckoutProfile,
} from '@/services/checkout-profile';

type CheckoutProfileProps = {
  email: string;
  profile: CheckoutProfile | null;
  addresses: CheckoutAddress[];
  loadError: boolean;
};
function useCheckoutState({ email, profile, addresses, loadError }: CheckoutProfileProps) {
  const { items, ready, coupon, clear } = useCart();
  const [information, setInformation] = useState<CheckoutInformation>(() =>
    initialCheckoutInformation(email, profile, addresses[0] ?? null),
  );
  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id ?? '');
  const [informationSubmitted, setInformationSubmitted] = useState(false);
  const [selection, setSelection] = useState<{ id: string; context: string } | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [gift, setGift] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [taxDocument, setTaxDocument] = useState('');
  const [installments, setInstallments] = useState(1);
  const [order, setOrder] = useState<CheckoutPaymentResult | null>(null);
  const [quote, setQuote] = useState<{
    id: string;
    expiresAt: string;
    context: string;
    options: ShippingOption[];
  } | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const quoteSequence = useRef(0);
  const requestKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [recovering, setRecovering] = useState(true);
  const [recoveryError, setRecoveryError] = useState('');
  useEffect(() => {
    let disposed = false;
    const id = new URLSearchParams(window.location.search).get('pedido');
    async function recover() {
      try {
        if (id) {
          const result = await checkOrderPayment(id);
          if (!disposed && result.order) setOrder(result.order);
          else if (!disposed)
            setRecoveryError(result.error ?? 'Não foi possível recuperar o pedido agora.');
        }
      } catch {
        if (!disposed) setRecoveryError('Não foi possível recuperar o pedido agora.');
      } finally {
        if (!disposed) setRecovering(false);
      }
    }
    void recover();
    return () => {
      disposed = true;
    };
  }, []);
  const informationValid = informationSubmitted && isInformationValid(information);
  const context = shippingContextKey(information, items);
  const shippingOptions = quote?.context === context ? quote.options : [];
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
  async function loadShipping(refresh = false) {
    const sequence = ++quoteSequence.current;
    setShippingLoading(true);
    setShippingError('');
    setSelection(null);
    try {
      const result = await getShippingQuotes(
        { information, items: items.map(({ id, size, color, qty }) => ({ id, size, color, qty })) },
        refresh,
      );
      if (sequence !== quoteSequence.current) return;
      if (!result.quoteId || !result.options || !result.expiresAt) {
        setQuote(null);
        setShippingError(result.error ?? 'Não foi possível calcular o frete.');
        return;
      }
      setQuote({
        id: result.quoteId,
        context,
        expiresAt: result.expiresAt,
        options: result.options,
      });
    } catch {
      if (sequence === quoteSequence.current)
        setShippingError('Não foi possível calcular o frete. Tente novamente.');
    } finally {
      if (sequence === quoteSequence.current) setShippingLoading(false);
    }
  }
  async function completePayment(
    card?: CardPaymentData,
  ): Promise<{ error?: string; loginRequired?: boolean }> {
    if (submitting.current) return { error: 'O pedido já está sendo registrado.' };
    if (
      order ||
      !ready ||
      !items.length ||
      !informationValid ||
      !shipping ||
      !quote ||
      !payment ||
      !isTaxDocumentValid(taxDocument)
    )
      return { error: 'Revise as informações, o frete e o pagamento.' };
    submitting.current = true;
    requestKey.current ??= crypto.randomUUID();
    try {
      const result = await placeOrder(
        {
          key: requestKey.current,
          quoteId: quote.id,
          information,
          items: items.map(({ id, size, color, qty }) => ({ id, size, color, qty })),
          shipping: shipping.id,
          payment,
          installments: card?.installments ?? installments,
          gift,
          giftWrap,
          taxDocument,
          coupon: coupon?.code ?? '',
          expectedTotal: Math.round(totals.total * 100),
        },
        card,
      );
      if (!result.order) return result;
      setOrder(result.order);
      window.history.replaceState(null, '', `/checkout/payment?pedido=${result.order.id}`);
      setTaxDocument('');
      setGift(false);
      setGiftWrap(false);
      setPayment(null);
      setInstallments(1);
      if (result.order.paymentStatus === 'approved') clear();
      return { error: result.error };
    } catch {
      return { error: 'Não foi possível salvar. Tente novamente.' };
    } finally {
      submitting.current = false;
    }
  }
  return {
    ready: ready && !recovering,
    recoveryError,
    items,
    information,
    addresses,
    selectedAddressId,
    profileLoadError: loadError,
    selectAddress: (id: string) => {
      const address = addresses.find((entry) => entry.id === id);
      if (id && !address) return;
      setSelectedAddressId(id);
      setInformation((current) =>
        applyCheckoutAddress(current, address ?? null, profile?.full_name ?? ''),
      );
      setInformationSubmitted(false);
      setSelection(null);
    },
    informationValid,
    submitInformation,
    updateInformation: (patch: Partial<CheckoutInformation>) => {
      if (
        Object.keys(patch).some((key) =>
          [
            'firstName',
            'lastName',
            'postalCode',
            'street',
            'number',
            'complement',
            'district',
            'city',
            'state',
          ].includes(key),
        )
      )
        setSelectedAddressId('');
      setInformation((current) => ({ ...current, ...patch, email }));
    },
    shippingOptions,
    shippingLoading,
    shippingError,
    loadShipping,
    shippingContext: context,
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
    completePayment,
  };
}
const CheckoutContext = createContext<ReturnType<typeof useCheckoutState> | null>(null);
export function CheckoutProvider({
  children,
  ...profile
}: CheckoutProfileProps & { children: ReactNode }) {
  return (
    <CheckoutContext.Provider value={useCheckoutState(profile)}>
      {children}
    </CheckoutContext.Provider>
  );
}
export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) throw new Error('useCheckout requires CheckoutProvider');
  return context;
}
