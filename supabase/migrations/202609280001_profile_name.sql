begin;
-- Only display data comes from user metadata. Administrative permissions never do.
create or replace function private.create_profile()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 200));
  return new;
end;
$$;
revoke all on function private.create_profile() from public, anon, authenticated;

update public.profiles p
set full_name = left(trim(u.raw_user_meta_data ->> 'full_name'), 200)
from auth.users u
where p.id = u.id and p.full_name = ''
  and jsonb_typeof(u.raw_user_meta_data -> 'full_name') = 'string';
commit;
