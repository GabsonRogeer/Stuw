'use client';
import { useActionState } from 'react';
import { saveCoupon, toggleCoupon } from '@/app/admin/cupons/actions';
import { Button } from '@/components/ui/button/button';
import { couponDateInput } from '@/services/coupons';
import type { Coupon } from '@/types/database';
const field =
  'block w-full mt-2 border border-stuw-border dark:border-stuw-borderDark rounded-md px-3 py-3 bg-white dark:bg-stone-900 text-sm';
export function CouponEditor({ coupon }: { coupon?: Coupon }) {
  const [state, action, pending] = useActionState(saveCoupon, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={coupon?.id ?? ''} />
      <fieldset disabled={pending} className="grid sm:grid-cols-2 gap-5">
        <label className="text-sm">
          Código do cupom
          <input
            name="code"
            required
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
            defaultValue={coupon?.code ?? ''}
            placeholder="BEMVINDA10"
            autoCapitalize="characters"
            className={field}
          />
        </label>
        <label className="text-sm">
          Desconto (%)
          <input
            type="number"
            name="percent"
            min="0.01"
            max="100"
            step="0.01"
            required
            defaultValue={coupon?.percent ?? ''}
            className={field}
          />
        </label>
        <label className="text-sm">
          Limite de utilizações
          <input
            type="number"
            name="max_uses"
            min={Math.max(1, coupon?.used_count ?? 0)}
            max="1000000000"
            step="1"
            required
            defaultValue={coupon?.max_uses ?? ''}
            className={field}
          />
        </label>
        <label className="text-sm">
          Válido até
          <input
            type="date"
            name="expires_on"
            required
            defaultValue={coupon ? couponDateInput(coupon.expires_at) : ''}
            className={field}
          />
          <span className="text-xs text-stuw-slate block mt-2">
            Até 23h59, horário de Brasília.
          </span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="active" defaultChecked={coupon?.active ?? true} />
          Cupom ativo
        </label>
      </fieldset>
      <p className="text-xs text-stuw-slate">
        Percentual sobre produtos, frete e embalagem. O desconto de PIX é calculado depois, sobre os
        produtos já descontados.
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : coupon ? 'Salvar alterações' : 'Cadastrar cupom'}
      </Button>
    </form>
  );
}
export function CouponToggle({ coupon }: { coupon: Coupon }) {
  const [state, action, pending] = useActionState(toggleCoupon, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={coupon.id} />
      <input type="hidden" name="active" value={String(!coupon.active)} />
      <button type="submit" disabled={pending} className="text-sm underline disabled:opacity-50">
        {pending ? 'Atualizando…' : coupon.active ? 'Desativar' : 'Reativar'}
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300 mt-2">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-xs mt-2">
          {state.message}
        </p>
      )}
    </form>
  );
}
