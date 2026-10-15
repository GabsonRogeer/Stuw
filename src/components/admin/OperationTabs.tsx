'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ClipboardList, Boxes, History, UsersRound } from 'lucide-react';

export function OperationTabs({
  stock,
  audit,
  team,
}: {
  stock: boolean;
  audit: boolean;
  team: boolean;
}) {
  const params = useSearchParams();
  const path = usePathname();
  const selected = path.startsWith('/operacao/pedidos/')
    ? 'orders'
    : (params.get('view') ?? 'orders');
  const tabs = [
    { key: 'orders', label: 'Pedidos', icon: ClipboardList, show: true },
    { key: 'stock', label: 'Estoque', icon: Boxes, show: stock },
    { key: 'audit', label: 'Histórico', icon: History, show: audit },
    { key: 'team', label: 'Equipe', icon: UsersRound, show: team },
  ];
  return (
    <nav className="ops-tabs" aria-label="Áreas da operação">
      {tabs
        .filter((t) => t.show)
        .map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={key === 'orders' ? '/operacao' : `/operacao?view=${key}`}
            aria-current={selected === key ? 'page' : undefined}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </Link>
        ))}
    </nav>
  );
}
