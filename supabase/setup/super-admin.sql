-- Run after the account_area migration, as postgres in SQL Editor.
begin;
do $$
declare target_user uuid;
begin
  select id into strict target_user from auth.users
  where lower(email) = lower('gabsonrsp.dev@gmail.com')
    and email_confirmed_at is not null;
  insert into private.admin_users (user_id, role)
  values (target_user, 'super_admin')
  on conflict (user_id) do update set role = 'super_admin';
exception
  when no_data_found then raise exception 'Cadastre e confirme o e-mail da conta antes de promover a super admin.';
  when too_many_rows then raise exception 'Mais de uma conta encontrada. Verifique os usuários antes de continuar.';
end;
$$;
select user_id, role from private.admin_users
where user_id = (select id from auth.users where lower(email) = lower('gabsonrsp.dev@gmail.com'));
commit;
