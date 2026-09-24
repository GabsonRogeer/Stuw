'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '@/providers/cart-provider';
import { currency, FREE_SHIPPING_THRESHOLD, itemKey } from '@/lib/commerce';
import { Modal } from '@/components/ui/modal/modal';
import { CouponForm } from '@/components/cart/CouponForm/CouponForm';
import { OrderSummary } from '@/components/cart/OrderSummary/OrderSummary';

export function CartDrawer({ onClose }: { onClose: () => void }) {
  const { items, count, changeQuantity, removeItem, totals } = useCart();
  return (
    <Modal title={`Sua sacola (${count})`} onClose={onClose} drawer>
      {items.length === 0 ? (
        <div className="py-12 text-center space-y-6">
          <p className="text-sm text-stuw-slate">Sua próxima peça favorita está aqui.</p>
          <Link href="/produtos" onClick={onClose} className="underline text-sm">
            Explorar coleção
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <p className="text-xs">
              {totals.subtotal >= FREE_SHIPPING_THRESHOLD
                ? 'Frete cortesia para você.'
                : `Faltam ${currency(FREE_SHIPPING_THRESHOLD - totals.subtotal)} para frete cortesia.`}
            </p>
            <progress
              aria-label="Progresso para frete cortesia"
              value={Math.min(totals.subtotal, FREE_SHIPPING_THRESHOLD)}
              max={FREE_SHIPPING_THRESHOLD}
              className="w-full h-1 accent-stuw-sage"
            />
          </div>
          <ul className="space-y-6">
            {items.map((item) => (
              <li key={itemKey(item)} className="flex gap-4">
                <Image
                  src={item.image}
                  alt={item.title}
                  width={80}
                  height={108}
                  className="w-20 h-28 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <h3 className="text-xs leading-relaxed">{item.title}</h3>
                    <button
                      onClick={() => removeItem(itemKey(item))}
                      aria-label={`Remover ${item.title}, ${item.color}, ${item.size}`}
                      className="p-1 self-start"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-stuw-slate mt-1">
                    {item.color} / {item.size}
                  </p>
                  <div className="flex items-center justify-between mt-4 gap-2">
                    <div className="flex items-center border border-stuw-border dark:border-stuw-borderDark">
                      <button
                        className="p-2"
                        aria-label={`Diminuir quantidade de ${item.title}`}
                        onClick={() => changeQuantity(itemKey(item), -1)}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs min-w-5 text-center">{item.qty}</span>
                      <button
                        className="p-2"
                        disabled={item.qty >= 99}
                        aria-label={`Aumentar quantidade de ${item.title}`}
                        onClick={() => changeQuantity(itemKey(item), 1)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="text-xs">{currency(item.price * item.qty)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <CouponForm />
          <OrderSummary totals={totals} />
          <Link
            href="/checkout/information"
            onClick={onClose}
            className="block text-center bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian py-4 text-xs tracking-widest uppercase"
          >
            Continuar para checkout
          </Link>
        </>
      )}
    </Modal>
  );
}
