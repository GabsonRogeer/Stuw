import type { CartItem } from '@/types';

export type CheckoutStep = 'information' | 'shipping' | 'payment';
export type PaymentMethod = 'pix' | 'card';
export type CheckoutInformation = {
  email: string;
  firstName: string;
  lastName: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  phone: string;
  emailOffers: boolean;
  whatsappOffers: boolean;
};
export const BRAZIL_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];
export const EMPTY_INFORMATION: CheckoutInformation = {
  email: '',
  firstName: '',
  lastName: '',
  postalCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  phone: '',
  emailOffers: false,
  whatsappOffers: false,
};
export const DEMO_INFORMATION: CheckoutInformation = {
  ...EMPTY_INFORMATION,
  email: 'demo@example.com',
  firstName: 'Cliente',
  lastName: 'Demonstração',
  postalCode: '01001-000',
  street: 'Rua de demonstração',
  number: '100',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  phone: '(11) 99999-9999',
};

export function isInformationValid(info: CheckoutInformation) {
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email.trim()) &&
    [info.firstName, info.lastName, info.street, info.number, info.district, info.city].every(
      (value) => value.trim().length > 0,
    ) &&
    /^\d{5}-?\d{3}$/.test(info.postalCode.trim()) &&
    BRAZIL_STATES.includes(info.state) &&
    /^\d{10,11}$/.test(info.phone.replace(/\D/g, ''))
  );
}

export function shippingContextKey(info: CheckoutInformation, items: CartItem[]) {
  return JSON.stringify([
    info.postalCode.replace(/\D/g, ''),
    info.street.trim(),
    info.number.trim(),
    info.complement.trim(),
    info.district.trim(),
    info.city.trim(),
    info.state,
    items.map((item) => [item.id, item.color, item.size, item.qty, item.price]),
  ]);
}

export function checkoutRedirect(
  step: CheckoutStep,
  informationValid: boolean,
  shippingValid: boolean,
) {
  if (step !== 'information' && !informationValid) return '/checkout/information';
  if (step === 'payment' && !shippingValid) return '/checkout/shipping';
  return null;
}

export function isTaxDocumentValid(input: string) {
  const value = input.toUpperCase().replace(/[.\/\-\s]/g, '');
  if (/^(.)\1+$/.test(value)) return false;
  if (/^\d{11}$/.test(value)) {
    const digit = (length: number) => {
      const sum = [...value.slice(0, length)].reduce(
        (total, char, index) => total + Number(char) * (length + 1 - index),
        0,
      );
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
  }
  // Receita Federal: numeric and alphanumeric CNPJ use ASCII - 48 and modulo 11.
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value)) return false;
  const digit = (length: number) => {
    const sum = [...value.slice(0, length)].reduce(
      (total, char, index) => total + (char.charCodeAt(0) - 48) * (((length - index - 1) % 8) + 2),
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}
