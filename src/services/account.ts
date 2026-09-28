export const STATES = [
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
export type AddressInput = {
  label: string;
  recipient: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};
export function validateProfile(name: string, birthDate: string, phone: string) {
  if (name.trim().length < 2 || name.trim().length > 200)
    return 'Informe seu nome completo (2 a 200 caracteres).';
  if (phone && !/^\d{10,11}$/.test(phone)) return 'Informe um telefone com DDD (10 ou 11 dígitos).';
  if (birthDate) {
    const date = new Date(birthDate + 'T12:00:00Z');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== birthDate ||
      birthDate < '1900-01-01' ||
      birthDate > new Date().toISOString().slice(0, 10)
    )
      return 'Informe uma data de nascimento válida.';
  }
  return null;
}
export function validateAddress(value: AddressInput) {
  for (const key of ['label', 'recipient', 'street', 'number', 'district', 'city'] as const) {
    if (!value[key].trim() || value[key].length > (key === 'number' ? 20 : 200))
      return 'Preencha os campos obrigatórios do endereço, respeitando o tamanho máximo.';
  }
  if (value.complement.length > 200) return 'O complemento deve ter até 200 caracteres.';
  if (!/^\d{8}$/.test(value.postal_code)) return 'Informe um CEP com 8 dígitos.';
  if (!STATES.includes(value.state)) return 'Selecione um estado válido.';
  return null;
}
