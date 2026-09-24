'use client';

import { useState } from 'react';
import { useCart } from '@/providers/cart-provider';
import { Button } from '@/components/ui/button/button';

export function CouponForm() {
  const { coupon, setCoupon } = useCart();
  const [code, setCode] = useState(coupon);
  const [message, setMessage] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const normalized = code.trim().toUpperCase();
        if (normalized === 'PRIVE10') {
          setCoupon(normalized);
          setMessage('Cupom aplicado.');
        } else setMessage('Cupom inválido.');
      }}
      className="space-y-2"
    >
      <div className="flex gap-2">
        <input
          aria-label="Cupom de desconto"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Cupom de desconto"
          className="field min-w-0"
        />
        <Button type="submit" className="!px-4 rounded-lg">
          Aplicar
        </Button>
      </div>
      <p role="status" className="text-xs">
        {message}
      </p>
      {coupon && (
        <button
          type="button"
          className="text-xs underline"
          onClick={() => {
            setCoupon('');
            setCode('');
            setMessage('Cupom removido.');
          }}
        >
          Remover cupom {coupon}
        </button>
      )}
    </form>
  );
}
