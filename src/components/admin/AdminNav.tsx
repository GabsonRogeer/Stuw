'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TicketPercent, Image, ShoppingBag, ChartNoAxesCombined, UserRound } from 'lucide-react';
import { LogoutButton } from '@/components/auth/LogoutButton';
const links = [
  ['/admin/produtos', 'Produtos', ShoppingBag, false],
  ['/admin/cupons', 'Cupons', TicketPercent, false],
  ['/admin/banners', 'Banners', Image, false],
  ['/admin/pedidos', 'Pedidos', ShoppingBag, false],
  ['/admin/atacado', 'Atacado', ShoppingBag, false],
  ['/admin/relatorios', 'Relatórios', ChartNoAxesCombined, true],
] as const;
export function AdminNav({ superAdmin }: { superAdmin: boolean }) {
  const path = usePathname();
  return (
    <aside>
      <p className="eyebrow mb-5">{superAdmin ? 'Super admin' : 'Administrador'}</p>
      <nav aria-label="Administração" className="space-y-1">
        {links.map(([href, label, Icon, soon]) => (
          <Link
            key={href}
            href={href}
            aria-current={path.startsWith(href) ? 'page' : undefined}
            className={
              'flex items-center gap-3 px-4 py-3 rounded-md border-l-2 text-sm ' +
              (path.startsWith(href)
                ? 'border-stuw-sage bg-stuw-sand dark:bg-stone-800 font-medium'
                : 'border-transparent hover:bg-stuw-sand/50 dark:hover:bg-stone-800')
            }
          >
            <Icon size={18} />
            <span>{label}</span>
            {soon && <span className="ml-auto text-[10px] text-stuw-slate">Em breve</span>}
          </Link>
        ))}
      </nav>
      <div className="mt-6 pt-6 border-t border-stuw-border dark:border-stuw-borderDark space-y-5">
        <Link href="/conta" className="flex gap-3 items-center text-sm">
          <UserRound size={17} />
          Minha conta
        </Link>
        <LogoutButton />
      </div>
    </aside>
  );
}
