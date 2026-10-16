import { STATES } from './account';

export type PostalAddress = {
  postalCode: string;
  street: string;
  district: string;
  city: string;
  state: string;
};
type AddressFields = Omit<PostalAddress, 'postalCode'>;

export function postalCodeDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function formatPostalCode(value: string) {
  return postalCodeDigits(value)
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2');
}

// Generic municipal CEPs can legitimately omit street and district.
export function parsePostalAddress(value: unknown, expected: string): PostalAddress {
  if (!value || typeof value !== 'object') throw new Error('Invalid postal response');
  const record = value as Record<string, unknown>;
  const text = (key: string) => {
    const field = record[key];
    if (typeof field !== 'string' || field.length > 180) throw new Error('Invalid postal response');
    return field.trim();
  };
  const postalCode = text('cep');
  const state = text('uf');
  const city = text('localidade');
  if (
    !/^\d{5}-?\d{3}$/.test(postalCode) ||
    postalCodeDigits(postalCode) !== expected ||
    !STATES.includes(state) ||
    !city
  )
    throw new Error('Invalid postal response');
  return {
    postalCode: expected,
    street: text('logradouro'),
    district: text('bairro'),
    city,
    state,
  };
}

// Preserve fields edited manually while the request was in flight. Number,
// complement and recipient are deliberately outside this patch.
export function postalAddressPatch(
  current: AddressFields,
  baseline: AddressFields,
  found: PostalAddress,
): Partial<AddressFields> {
  return Object.fromEntries(
    (['street', 'district', 'city', 'state'] as const)
      .filter((key) => current[key] === baseline[key])
      .map((key) => [key, found[key]]),
  );
}
