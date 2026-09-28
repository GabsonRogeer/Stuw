begin;
alter table public.profiles
  add column birth_date date check (birth_date >= date '1900-01-01' and birth_date <= current_date),
  add column phone text check (phone ~ '^[0-9]{10,11}$');
grant update (birth_date, phone) on public.profiles to authenticated;

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 200),
  recipient text not null check (char_length(trim(recipient)) between 1 and 200),
  postal_code text not null check (postal_code ~ '^[0-9]{8}$'),
  street text not null check (char_length(trim(street)) between 1 and 200),
  number text not null check (char_length(trim(number)) between 1 and 20),
  complement text not null default '' check (char_length(complement) <= 200),
  district text not null check (char_length(trim(district)) between 1 and 200),
  city text not null check (char_length(trim(city)) between 1 and 200),
  state text not null check (state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  created_at timestamptz not null default now()
);
create index addresses_user_created_idx on public.addresses(user_id, created_at);
alter table public.addresses enable row level security;
revoke all on public.addresses from public, anon, authenticated;
grant select, delete on public.addresses to authenticated;
grant insert (user_id,label,recipient,postal_code,street,number,complement,district,city,state) on public.addresses to authenticated;
grant update (label,recipient,postal_code,street,number,complement,district,city,state) on public.addresses to authenticated;
grant all on public.addresses to service_role;
create policy addresses_select_own on public.addresses for select to authenticated using (user_id = (select auth.uid()));
create policy addresses_insert_own on public.addresses for insert to authenticated with check (user_id = (select auth.uid()));
create policy addresses_update_own on public.addresses for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy addresses_delete_own on public.addresses for delete to authenticated using (user_id = (select auth.uid()));

-- Read model for purchases. Only trusted integrations can write orders.
-- The demo checkout intentionally does not create paid orders.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  number text not null unique check (char_length(number) between 1 and 100),
  status text not null default 'pending' check (status in ('pending','paid','shipped','delivered','cancelled')),
  total_cents bigint not null check (total_cents between 0 and 999999999),
  created_at timestamptz not null default now()
);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
alter table public.orders enable row level security;
revoke all on public.orders from public, anon, authenticated;
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
create policy orders_select_own on public.orders for select to authenticated using (user_id = (select auth.uid()));
create policy orders_select_admin on public.orders for select to authenticated using ((select public.is_admin()));

alter table private.admin_users add column role text not null default 'admin' check (role in ('admin','super_admin'));

create function private.has_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from private.admin_users
    where user_id = (select auth.uid()) and role = 'super_admin'
  );
$$;
revoke all on function private.has_super_admin() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_super_admin() to authenticated;
-- Exposed wrapper runs as invoker. Private remains outside the Data API schemas.
create function public.is_super_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.has_super_admin(); $$;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;
commit;
