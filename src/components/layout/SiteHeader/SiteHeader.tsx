'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, Menu, Moon, Search, ShoppingBag, Sun, UserRound } from 'lucide-react';
import { useCart } from '@/providers/cart-provider';
import { useWishlist } from '@/providers/wishlist-provider';
import { useStorefront } from '@/providers/storefront-provider';
import { useTheme } from '@/hooks/use-theme';
import { categories, activityCategories } from '@/data/navigation';
import { Modal } from '@/components/ui/modal/modal';

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const { count } = useCart();
  const { ids } = useWishlist();
  const { setPanel } = useStorefront();
  const { dark, toggle } = useTheme();
  const [mobile, setMobile] = useState(false);
  return (
    <header className="sticky top-0 z-40 glass-header border-b border-stuw-border dark:border-stuw-borderDark">
      <div className="page-container h-20 flex items-center justify-between relative gap-3">
        <div className="flex gap-1 items-center">
          {!compact && (
            <button
              aria-label="Abrir menu"
              className="p-2 lg:hidden"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
          )}
          {!compact && (
            <Link href="/produtos" className="hidden lg:block text-xs tracking-widest uppercase">
              Activewear & Wellness
            </Link>
          )}
          <button
            aria-label="Buscar produtos"
            className="p-2 lg:hidden"
            onClick={() => setPanel('search')}
          >
            <Search size={19} />
          </button>
        </div>
        <Link
          href="/"
          aria-label="STUW — início"
          className="absolute left-1/2 -translate-x-1/2 text-2xl sm:text-4xl font-light tracking-[.25em]"
        >
          STUW
        </Link>
        <div className="flex items-center gap-0 sm:gap-2">
          <button
            aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            onClick={toggle}
            className="p-2 hidden sm:block"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            aria-label="Buscar produtos"
            onClick={() => setPanel('search')}
            className="p-2 hidden lg:block"
          >
            <Search size={19} />
          </button>
          <button
            aria-label={`Favoritos (${ids.length})`}
            className="p-1.5 sm:p-2 relative"
            onClick={() => setPanel('wishlist')}
          >
            <Heart size={19} />
            {ids.length > 0 && <span className="count-badge">{ids.length}</span>}
          </button>
          <Link
            href="/login"
            aria-label="Acessar minha conta"
            title="Minha conta"
            className="p-1.5 sm:p-2 hover:text-stuw-sage dark:hover:text-stuw-champagne silk-transition"
          >
            <UserRound size={19} aria-hidden="true" />
          </Link>
          <button
            aria-label={`Sacola (${count})`}
            className="p-1.5 sm:p-2 relative"
            onClick={() => setPanel('cart')}
          >
            <ShoppingBag size={19} />
            {count > 0 && <span className="count-badge">{count}</span>}
          </button>
        </div>
      </div>
      {!compact && (
        <nav
          aria-label="Categorias"
          className="hidden lg:flex items-center gap-6 px-8 pb-5 overflow-x-auto whitespace-nowrap text-[11px] tracking-wider"
        >
          <Link href="/produtos">Ver tudo</Link>
          <Link href="/atacado">Atacado</Link>
          {categories.map((category) => (
            <Link
              key={category.value}
              href={`/produtos?categoria=${encodeURIComponent(category.value)}`}
              className="hover:text-stuw-sage"
            >
              {category.label}
            </Link>
          ))}
          {activityCategories.map((category) => (
            <Link
              key={category.value}
              href={`/produtos?categoria=${encodeURIComponent(category.value)}`}
              className="hover:text-stuw-sage"
            >
              {category.label}
            </Link>
          ))}
          <Link href="/#sensorial">O toque STUW</Link>
        </nav>
      )}
      {mobile && (
        <Modal title="Explorar STUW" onClose={() => setMobile(false)} drawer>
          <nav aria-label="Menu mobile" className="flex flex-col gap-6 text-sm">
            <Link href="/atacado" onClick={() => setMobile(false)}>
              Atacado
            </Link>
            <Link href="/produtos" onClick={() => setMobile(false)}>
              Ver coleção
            </Link>
            <Link
              href="/login"
              onClick={() => setMobile(false)}
              className="inline-flex items-center gap-3"
            >
              <UserRound size={18} aria-hidden="true" /> Minha conta
            </Link>
            {categories.map((category) => (
              <Link
                key={category.value}
                href={`/produtos?categoria=${encodeURIComponent(category.value)}`}
                onClick={() => setMobile(false)}
              >
                {category.label}
              </Link>
            ))}
            <p className="eyebrow">Por atividade</p>
            {activityCategories.map((category) => (
              <Link
                key={category.value}
                href={`/produtos?categoria=${encodeURIComponent(category.value)}`}
                onClick={() => setMobile(false)}
              >
                {category.label}
              </Link>
            ))}
            <button onClick={toggle} className="text-left">
              {dark ? 'Tema claro' : 'Tema escuro'}
            </button>
          </nav>
        </Modal>
      )}
    </header>
  );
}
