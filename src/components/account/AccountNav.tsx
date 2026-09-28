'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, MapPin, ShoppingBag, UserRound, ShieldCheck } from 'lucide-react';
import { LogoutButton } from '@/components/auth/LogoutButton';
const links = [
  ['/conta', 'Dados pessoais', UserRound],
  ['/conta/enderecos', 'Endereços de entrega', MapPin],
  ['/conta/compras', 'Minhas compras', ShoppingBag],
  ['/conta/cotacoes', 'Minhas cotações', ShoppingBag],
  ['/conta/wishlist', 'Wishlist', Heart],
] as const;
export function AccountNav({
  name,
  email,
  admin,
}: {
  name: string;
  email: string;
  admin: boolean;
}) {
  const pathname = usePathname();
  return (
    <aside className="min-w-0">
      <div className="mb-7 flex items-center gap-3">
        <div className="w-12 h-12 shrink-0 rounded-full bg-stuw-sand dark:bg-stone-800 flex items-center justify-center font-serif text-xl">
          {name.slice(0, 1).toUpperCase() || <UserRound size={22} />}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{name || 'Sua conta STUW'}</p>
          <p className="text-xs text-stuw-slate truncate">{email}</p>
        </div>
      </div>
      <nav aria-label="Minha conta" className="space-y-1">
        {links.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              pathname === href || (href !== '/conta' && pathname.startsWith(href + '/'))
                ? 'page'
                : undefined
            }
            className={
              'flex items-center gap-3 rounded-md px-4 py-3 text-sm border-l-2 ' +
              (pathname === href || (href !== '/conta' && pathname.startsWith(href + '/'))
                ? 'border-stuw-sage bg-stuw-sand dark:bg-stone-800 font-medium'
                : 'border-transparent hover:bg-stuw-sand/50 dark:hover:bg-stone-800')
            }
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
        {admin && (
          <Link href="/admin" className="flex gap-3 items-center text-sm px-4 py-3">
            <ShieldCheck size={17} />
            Administração
          </Link>
        )}
      </nav>
      <div className="mt-6 pt-6 border-t border-stuw-border dark:border-stuw-borderDark">
        <LogoutButton />
      </div>
    </aside>
  );
}
