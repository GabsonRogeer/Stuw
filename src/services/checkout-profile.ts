import { EMPTY_INFORMATION, type CheckoutInformation } from './checkout';
import type { Address } from '@/types/database';
export type CheckoutAddress = Omit<Address, 'user_id' | 'created_at'>;
export type CheckoutProfile = { full_name: string; phone: string | null };
export function splitRecipient(name: string) {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}
export function applyCheckoutAddress(
  current: CheckoutInformation,
  address: CheckoutAddress | null,
  profileName: string,
): CheckoutInformation {
  return {
    ...current,
    ...splitRecipient(address?.recipient || profileName),
    postalCode: address?.postal_code ?? '',
    street: address?.street ?? '',
    number: address?.number ?? '',
    complement: address?.complement ?? '',
    district: address?.district ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
  };
}
export function initialCheckoutInformation(
  email: string,
  profile: CheckoutProfile | null,
  address: CheckoutAddress | null,
) {
  return applyCheckoutAddress(
    { ...EMPTY_INFORMATION, email, phone: profile?.phone ?? '' },
    address,
    profile?.full_name ?? '',
  );
}
