begin;
create table public.coupons (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
 percent numeric(5,2) not null check (percent > 0 and percent <= 100),
 active boolean not null default true,
 max_uses integer not null check (max_uses between 1 and 1000000000),
 used_count integer not null default 0 check (used_count >= 0 and used_count <= max_uses),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
revoke all on public.coupons from public, anon, authenticated;
grant select on public.coupons to authenticated;
grant insert (code,percent,active,max_uses,expires_at) on public.coupons to authenticated;
grant update (code,percent,active,max_uses,expires_at) on public.coupons to authenticated;
grant all on public.coupons to service_role;
create policy coupons_admin_read on public.coupons for select to authenticated using ((select public.is_admin()));
create policy coupons_admin_create on public.coupons for insert to authenticated with check ((select public.is_admin()));
create policy coupons_admin_update on public.coupons for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Guest lookup deliberately exposes only an exact, available code, not statistics.
create function private.lookup_coupon(input_code text)
returns table(code text, percent numeric, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
 select c.code, c.percent, c.expires_at from public.coupons c
 where c.code = upper(trim(input_code)) and c.active
 and c.expires_at > now() and c.used_count < c.max_uses limit 1;
$$;
revoke all on function private.lookup_coupon(text) from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.lookup_coupon(text) to anon, authenticated;
create function public.lookup_coupon(input_code text)
returns table(code text, percent numeric, expires_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.lookup_coupon(input_code); $$;
revoke all on function public.lookup_coupon(text) from public;
grant execute on function public.lookup_coupon(text) to anon, authenticated;

create table public.coupon_redemptions (
 order_id uuid primary key references public.orders(id) on delete restrict,
 coupon_id uuid not null references public.coupons(id) on delete restrict,
 coupon_code text not null,
 percent numeric(5,2) not null,
 base_total_cents bigint not null check (base_total_cents > 0),
 discount_cents bigint not null check (discount_cents >= 0 and discount_cents <= base_total_cents),
 created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions(coupon_id);
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupon_redemptions from public, anon, authenticated;
grant select on public.coupon_redemptions to authenticated;
grant all on public.coupon_redemptions to service_role;
create policy redemptions_admin_read on public.coupon_redemptions for select to authenticated using ((select public.is_admin()));

-- For a future trusted checkout: locks prevent exceeding limits; retries are
-- idempotent per order. Browsers and admin clients cannot invoke this function.
create function private.record_coupon_use(input_code text, input_order uuid)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
 c public.coupons%rowtype;
 o public.orders%rowtype;
 prior public.coupon_redemptions%rowtype;
 amount bigint;
begin
 select * into o from public.orders where id = input_order for update;
 if not found then raise exception 'Order not found'; end if;
 select * into prior from public.coupon_redemptions where order_id = input_order;
 if found then
   if prior.coupon_code <> upper(trim(input_code)) then raise exception 'Order already has a coupon'; end if;
   return prior.discount_cents;
 end if;
 if o.status <> 'pending' or o.total_cents <= 0 then raise exception 'Order not eligible'; end if;
 select * into c from public.coupons where code = upper(trim(input_code)) for update;
 if not found then raise exception 'Coupon unavailable'; end if;
 if not c.active or c.expires_at <= clock_timestamp() or c.used_count >= c.max_uses then raise exception 'Coupon unavailable'; end if;
 amount := round(o.total_cents * c.percent / 100);
 insert into public.coupon_redemptions (order_id,coupon_id,coupon_code,percent,base_total_cents,discount_cents)
 values (o.id,c.id,c.code,c.percent,o.total_cents,amount);
 update public.coupons set used_count = used_count + 1 where id = c.id;
 update public.orders set total_cents = total_cents - amount where id = o.id;
 return amount;
end;
$$;
revoke all on function private.record_coupon_use(text,uuid) from public, anon, authenticated;
grant execute on function private.record_coupon_use(text,uuid) to service_role;
create function public.record_coupon_use(input_code text, input_order uuid)
returns bigint language sql volatile security invoker set search_path = ''
as $$ select private.record_coupon_use(input_code,input_order); $$;
revoke all on function public.record_coupon_use(text,uuid) from public, anon, authenticated;
grant execute on function public.record_coupon_use(text,uuid) to service_role;
commit;
