begin;
-- Replace only the checks involving max_uses, preserving grants, RLS and history.
do $$ declare rule record; begin
 for rule in select c.conname from pg_constraint c
 join pg_attribute a on a.attrelid=c.conrelid and a.attname='max_uses'
 where c.conrelid='public.coupons'::regclass and c.contype='c' and a.attnum=any(c.conkey)
 loop execute format('alter table public.coupons drop constraint %I',rule.conname); end loop;
end; $$;
alter table public.coupons
 add constraint coupons_limit_range check (max_uses between 0 and 1000000000),
 add constraint coupons_usage_limit check (used_count >= 0 and (max_uses=0 or used_count <= max_uses));

create or replace function private.lookup_coupon(input_code text)
returns table(code text, percent numeric, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select c.code,c.percent,c.expires_at from public.coupons c
 where c.code=upper(trim(input_code)) and c.active and c.expires_at>now()
 and (c.max_uses=0 or c.used_count<c.max_uses) limit 1;
$$;

-- Existing privileged checkout entry point; execute privileges stay unchanged.
create or replace function private.record_coupon_use(input_code text, input_order uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
 c public.coupons%rowtype;
 o public.orders%rowtype;
 prior public.coupon_redemptions%rowtype;
 amount bigint;
begin
 select * into o from public.orders where id=input_order for update;
 if not found then raise exception 'Order not found'; end if;
 select * into prior from public.coupon_redemptions where order_id=input_order;
 if found then
  if prior.coupon_code<>upper(trim(input_code)) then raise exception 'Order already has a coupon'; end if;
  return prior.discount_cents;
 end if;
 if o.status<>'pending' or o.total_cents<=0 then raise exception 'Order not eligible'; end if;
 select * into c from public.coupons where code=upper(trim(input_code)) for update;
 if not found then raise exception 'Coupon unavailable'; end if;
 if not c.active or c.expires_at<=clock_timestamp() or (c.max_uses>0 and c.used_count>=c.max_uses)
 then raise exception 'Coupon unavailable'; end if;
 amount:=round(o.total_cents*c.percent/100);
 insert into public.coupon_redemptions(order_id,coupon_id,coupon_code,percent,base_total_cents,discount_cents)
 values(o.id,c.id,c.code,c.percent,o.total_cents,amount);
 update public.coupons set used_count=used_count+1 where id=c.id;
 update public.orders set total_cents=total_cents-amount where id=o.id;
 return amount;
end; $$;
commit;
