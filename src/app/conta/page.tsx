import { requireAccount } from '@/lib/supabase/account';
import { ProfileForm } from '@/components/account/ProfileForm';
export default async function AccountPage() {
  const { supabase, user } = await requireAccount();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name,birth_date,phone')
    .eq('id', user.id)
    .maybeSingle();
  return (
    <>
      <h2 className="font-serif text-3xl border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        Dados pessoais
      </h2>
      <p className="text-sm text-stuw-slate my-6">
        Atualize suas informações para uma experiência mais prática na STUW.
      </p>
      {error || !profile ? (
        <p role="alert">Não foi possível carregar seu perfil. Tente novamente mais tarde.</p>
      ) : (
        <ProfileForm
          key={[profile.full_name, profile.birth_date, profile.phone].join('|')}
          name={
            profile.full_name ||
            (typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : '')
          }
          birthDate={profile.birth_date ?? ''}
          phone={profile.phone ?? ''}
          email={user.email ?? ''}
        />
      )}
    </>
  );
}
