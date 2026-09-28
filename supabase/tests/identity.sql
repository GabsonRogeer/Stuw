-- Run as postgres in SQL Editor AFTER the migration. All fixtures are rolled back.
begin;
insert into auth.users (id, email) values
  ('f830b3e9-8c74-4a43-88de-ecb31d094001', 'rls-one@example.invalid'),
  ('f830b3e9-8c74-4a43-88de-ecb31d094002', 'rls-two@example.invalid');

set local role anon;
do $$
begin
  if exists (select 1 from public.profiles) then
    raise exception 'Anonymous user can read profiles';
  end if;
  begin
    perform public.is_admin();
    raise exception 'Anonymous user can call is_admin';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claims', '{"sub":"f830b3e9-8c74-4a43-88de-ecb31d094001","role":"authenticated"}', true);
set local role authenticated;
do $$
declare changed integer;
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'Customer must only read their own profile';
  end if;
  if public.is_admin() then raise exception 'Customer became admin'; end if;

  update public.profiles set full_name = 'Own profile'
    where id = 'f830b3e9-8c74-4a43-88de-ecb31d094001';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Customer cannot edit own name'; end if;

  update public.profiles set full_name = 'Forbidden'
    where id = 'f830b3e9-8c74-4a43-88de-ecb31d094002';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Customer edited another profile'; end if;

  begin
    insert into private.admin_users (user_id) values ('f830b3e9-8c74-4a43-88de-ecb31d094001');
    raise exception 'Customer can promote themselves';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set created_at = now();
    raise exception 'Customer can change protected columns';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profiles;
    raise exception 'Customer can delete profiles';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

insert into private.admin_users (user_id) values ('f830b3e9-8c74-4a43-88de-ecb31d094001');
set local role authenticated;
do $$
begin
  if not public.is_admin() then raise exception 'Admin permission missing'; end if;
  if not exists (select 1 from public.profiles where id = 'f830b3e9-8c74-4a43-88de-ecb31d094002') then
    raise exception 'Admin cannot read customer profile';
  end if;
end;
$$;
reset role;
delete from private.admin_users where user_id = 'f830b3e9-8c74-4a43-88de-ecb31d094001';
set local role authenticated;
do $$
begin
  if public.is_admin() then raise exception 'Revoked administrator still has permission'; end if;
end;
$$;
reset role;
rollback;
   