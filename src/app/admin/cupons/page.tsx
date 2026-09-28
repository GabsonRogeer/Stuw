import Link from 'next/link';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { CouponEditor, CouponToggle } from '@/components/admin/CouponEditor';
import { couponStatus } from '@/services/coupons';
const labels = {
  active: 'Ativo',
  inactive: 'Inativo',
  expired: 'Expirado',
  exhausted: 'Limite atingido',
};
export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase } = await requireAdminPage();
  const { status } = await searchParams;
  const filter = status && Object.hasOwn(labels, status) ? status : 'all';
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  // This authenticated async Server Component takes one clock snapshot per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const rows =
    data?.filter((coupon) => filter === 'all' || couponStatus(coupon, now) === filter) ?? [];
  return (
    <>
      <h2 className="font-serif text-3xl border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        Cupons de desconto
      </h2>
      <p className="text-sm text-stuw-slate my-5">
        Gerencie descontos, validade e quantidade de utilizações.
      </p>
      <nav aria-label="Filtrar cupons" className="flex flex-wrap gap-2 mb-7">
        {[['all', 'Todos'], ...Object.entries(labels)].map(([value, label]) => (
          <Link
            key={value}
            href={value === 'all' ? '/admin/cupons' : '/admin/cupons?status=' + value}
            aria-current={filter === value ? 'page' : undefined}
            className={
              'px-4 py-2 rounded-full text-xs border border-stuw-border dark:border-stuw-borderDark ' +
              (filter === value ? 'bg-stuw-sand dark:bg-stone-800' : '')
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      {error ? (
        <p role="alert" className="p-5 border rounded-md">
          Não foi possível carregar os cupons. Verifique se a migração foi aplicada e tente
          novamente.
        </p>
      ) : (
        <>
          <div className="space-y-4">
            {rows.length === 0 && (
              <p className="text-sm text-stuw-slate py-5">Nenhum cupom nesta seleção.</p>
            )}
            {rows.map((coupon) => (
              <article
                key={coupon.id}
                className="border border-stuw-border dark:border-stuw-borderDark rounded-lg p-5 sm:p-6"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h3 className="font-medium tracking-wider break-all">{coupon.code}</h3>
                    <p className="text-sm mt-2">
                      {coupon.percent}% de desconto · {labels[couponStatus(coupon, now)]}
                    </p>
                    <p className="text-xs text-stuw-slate mt-2">
                      {coupon.used_count} de {coupon.max_uses} utilizações · Expira em{' '}
                      {new Date(coupon.expires_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </p>
                  </div>
                  <CouponToggle coupon={coupon} />
                </div>
                <details className="mt-5 border-t border-stuw-border dark:border-stuw-borderDark pt-4">
                  <summary className="text-sm underline cursor-pointer">Editar cupom</summary>
                  <div className="mt-5">
                    <CouponEditor coupon={coupon} />
                  </div>
                </details>
              </article>
            ))}
          </div>
          <section className="mt-10 pt-8 border-t border-stuw-border dark:border-stuw-borderDark">
            <h3 className="font-serif text-2xl mb-6">Cadastrar cupom</h3>
            <CouponEditor />
          </section>
        </>
      )}
    </>
  );
}
