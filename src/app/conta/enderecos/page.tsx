import { requireAccount } from '@/lib/supabase/account';
import { AddressForm, DeleteAddress } from '@/components/account/AddressForm';
export default async function AddressesPage() {
  const { supabase, user } = await requireAccount();
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at');
  return (
    <>
      <h2 className="font-serif text-3xl border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        Endereços de entrega
      </h2>
      <p className="text-sm text-stuw-slate mt-4 mb-8">
        Cadastre seus endereços e mantenha os dados de entrega atualizados.
      </p>
      {error ? (
        <p role="alert">Não foi possível carregar os endereços. Tente novamente mais tarde.</p>
      ) : (
        <div className="space-y-5">
          {!data?.length && (
            <p className="text-sm text-stuw-slate">Você ainda não cadastrou um endereço.</p>
          )}
          {data?.map((address) => (
            <details
              key={address.id}
              className="rounded-lg border border-stuw-border dark:border-stuw-borderDark p-5"
            >
              <summary className="cursor-pointer">
                <span className="font-medium">{address.label}</span>
                <span className="block text-sm text-stuw-slate mt-2">
                  {address.street}, {address.number} — {address.city}/{address.state}
                </span>
                <span className="text-xs underline block mt-2">Editar endereço</span>
              </summary>
              <div className="mt-6">
                <AddressForm address={address} />
                <DeleteAddress id={address.id} />
              </div>
            </details>
          ))}
          <section className="border-t border-stuw-border dark:border-stuw-borderDark pt-8 mt-8">
            <h3 className="font-serif text-2xl mb-6">Adicionar novo endereço</h3>
            <AddressForm />
          </section>
        </div>
      )}
    </>
  );
}
