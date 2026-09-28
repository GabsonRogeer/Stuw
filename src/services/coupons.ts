export type CouponDraft = {
  code: string;
  percent: number;
  max_uses: number;
  expires_at: string;
  active: boolean;
};
export type AppliedCoupon = { code: string; percent: number; expires_at: string };
export function couponStatus(
  coupon: { active: boolean; expires_at: string; used_count: number; max_uses: number },
  now = Date.now(),
) {
  if (!coupon.active) return 'inactive';
  if (new Date(coupon.expires_at).getTime() <= now) return 'expired';
  if (coupon.used_count >= coupon.max_uses) return 'exhausted';
  return 'active';
}
export function parseCoupon(
  form: FormData,
  now = Date.now(),
): { value?: CouponDraft; error?: string } {
  const code = String(form.get('code') ?? '')
    .trim()
    .toUpperCase();
  const percent = Number(String(form.get('percent') ?? '').replace(',', '.'));
  const max_uses = Number(form.get('max_uses'));
  const date = String(form.get('expires_on') ?? '');
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code))
    return { error: 'Use um código de 3 a 32 letras, números, hífen ou sublinhado.' };
  if (
    !Number.isFinite(percent) ||
    percent <= 0 ||
    percent > 100 ||
    Math.abs(percent * 100 - Math.round(percent * 100)) > 0.00001
  )
    return {
      error: 'Informe um desconto maior que 0 e até 100%, com no máximo duas casas decimais.',
    };
  if (!Number.isSafeInteger(max_uses) || max_uses < 1 || max_uses > 1000000000)
    return { error: 'Informe um limite de usos inteiro entre 1 e 1 bilhão.' };
  const day = new Date(date + 'T12:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== date
  )
    return { error: 'Informe uma data de expiração válida.' };
  const expires_at = new Date(date + 'T23:59:59.999-03:00').toISOString();
  if (Date.parse(expires_at) <= now) return { error: 'A validade precisa terminar no futuro.' };
  return { value: { code, percent, max_uses, expires_at, active: form.get('active') === 'on' } };
}
export function couponDateInput(iso: string) {
  return new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
