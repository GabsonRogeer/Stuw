'use client';
import { useState } from 'react';
import { useCart } from '@/providers/cart-provider';
import { Button } from '@/components/ui/button/button';
import { validateCoupon } from '@/app/actions/coupon';
export function CouponForm() {
  const { coupon, setCoupon } = useCart();
  const [code, setCode] = useState(coupon?.code ?? '');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        try {
          const result = await validateCoupon(code);
          setCoupon(result.coupon ?? null);
          setMessage(result.error ?? 'Cupom aplicado.');
        } catch {
          setCoupon(null);
          setMessage('Não foi possível validar o cupom agora.');
        } finally {
          setPending(false);
        }
      }}
      className="space-y-2"
    >
      <div className="flex gap-2">
        <input
          aria-label="Cupom de desconto"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Cupom de desconto"
          maxLength={32}
          disabled={pending}
          className="field min-w-0"
        />
        <Button type="submit" disabled={pending} className="!px-4 rounded-lg">
          {pending ? 'Validando…' : 'Aplicar'}
        </Button>
      </div>
      <p role="status" className="text-xs">
        {message}
      </p>
      {coupon && (
        <button
          type="button"
          disabled={pending}
          className="text-xs underline"
          onClick={() => {
            setCoupon(null);
            setCode('');
            setMessage('Cupom removido.');
          }}
        >
          Remover cupom {coupon.code}
        </button>
      )}
    </form>
  );
}
