begin;

-- Kept outside the exposed Data API. Only the SQL owner manages administrators.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

create table private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;

create function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.admin_users where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy profiles_read_own on public.profiles
for select to authenticated using (id = (select auth.uid()));

create policy profiles_read_admin on public.profiles
for select to authenticated using ((select public.is_admin()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create function private.create_profile()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke all on function private.create_profile() from public, anon, authenticated;

create trigger stuw_create_profile after insert on auth.users
for each row execute function private.create_profile();

-- Also support accounts created before this migration.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

create function private.set_profile_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_profile_updated_at() from public, anon, authenticated;
create trigger stuw_profile_updated_at before update on public.profiles
for each row execute function private.set_profile_updated_at();

commit;
