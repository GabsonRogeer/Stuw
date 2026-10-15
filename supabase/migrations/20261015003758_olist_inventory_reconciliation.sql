begin;
set local lock_timeout='5s';

create table public.olist_inventory (
 sku text primary key references public.olist_skus(sku),
 physical integer check(physical between -1000000 and 1000000),
 reserved integer check(reserved between 0 and 1000000),
 observed_at timestamptz,
 checked_at timestamptz,
 next_check_at timestamptz not null default now(),
 error text,
 enabled boolean not null default false
);
create index olist_inventory_due on public.olist_inventory(next_check_at,sku);
alter table public.olist_inventory enable row level security;
revoke all on public.olist_inventory from public,anon,authenticated;
grant select on public.olist_inventory to authenticated;
create policy inventory_admin_read on public.olist_inventory for select to authenticated using ((select public.is_admin()));
grant all on public.olist_inventory to service_role;

-- Immutable component quantities, captured when the checkout reserves inventory.
create table private.olist_inventory_holds (
 order_id uuid not null references public.orders(id), sku text not null,
 quantity integer not null check(quantity>0),
 reflected_at timestamptz, evidence text,
 primary key(order_id,sku)
);
create index inventory_holds_sku on private.olist_inventory_holds(sku,order_id);
alter table private.olist_inventory_holds enable row level security;
revoke all on private.olist_inventory_holds from public,anon,authenticated;
grant select,insert,update on private.olist_inventory_holds to service_role;

create function private.capture_inventory_hold() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 insert into private.olist_inventory_holds(order_id,sku,quantity)
 select new.order_id,coalesce(c.component_sku,item->>'sku'),
 sum((item->>'qty')::integer*coalesce(c.quantity,1))::integer
 from public.orders o cross join lateral jsonb_array_elements(o.items) item
 left join private.product_kit_components c on c.kit_sku=item->>'sku'
 where o.id=new.order_id and not o.is_demo
 group by coalesce(c.component_sku,item->>'sku');
 return new;
end; $$;
revoke all on function private.capture_inventory_hold() from public,anon,authenticated;
grant execute on function private.capture_inventory_hold() to service_role;
create trigger capture_inventory_hold after insert on public.order_integrations
 for each row execute function private.capture_inventory_hold();
insert into private.olist_inventory_holds(order_id,sku,quantity)
select o.id,coalesce(c.component_sku,item->>'sku'),
 sum((item->>'qty')::integer*coalesce(c.quantity,1))::integer
from public.orders o join public.order_integrations i on i.order_id=o.id
cross join lateral jsonb_array_elements(o.items) item
left join private.product_kit_components c on c.kit_sku=item->>'sku'
where not o.is_demo and not i.stock_released
group by o.id,coalesce(c.component_sku,item->>'sku');

create function private.inventory_ambiguous(code text) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from private.olist_inventory_holds h
 join public.order_integrations i on i.order_id=h.order_id
 join public.olist_orders e on e.order_id=h.order_id
 where h.sku=code and not i.stock_released and h.reflected_at is null
 and (e.attempted_at is not null or e.remote_id is not null));
$$;
revoke all on function private.inventory_ambiguous(text) from public,anon,authenticated;
grant execute on function private.inventory_ambiguous(text) to service_role;

create function private.reconcile_inventory(code text) returns void
language plpgsql security invoker set search_path='' as $$
declare snap public.olist_inventory; held bigint; item private.product_skus; available integer;
begin
 select * into snap from public.olist_inventory where sku=code;
 if not found or not snap.enabled or snap.observed_at is null then return; end if;
 if private.inventory_ambiguous(code) then
   update public.olist_inventory set error='Pedido enviado: confirmar baixa automática na Olist antes de conciliar.' where sku=code;
   return;
 end if;
 -- Never release a local hold against a snapshot fetched before the evidence was recorded.
 if exists(select 1 from private.olist_inventory_holds where sku=code and reflected_at>=snap.observed_at) then
   update public.olist_inventory set error='Aguardando leitura posterior à confirmação da baixa.' where sku=code;
   return;
 end if;
 select coalesce(sum(h.quantity),0) into held from private.olist_inventory_holds h
 join public.order_integrations i on i.order_id=h.order_id
 where h.sku=code and not i.stock_released and h.reflected_at is null;
 select s.* into item from private.product_skus s where s.code=reconcile_inventory.code;
 available:=greatest(0,snap.physical-snap.reserved-held)::integer;
 if item.stock<>available then perform private.adjust_unit_stock(item.product_id,code,available-item.stock); end if;
end; $$;
revoke all on function private.reconcile_inventory(text) from public,anon,authenticated;
grant execute on function private.reconcile_inventory(text) to service_role;

create function public.apply_olist_inventory(code text,erp_id text,physical_stock integer,reserved_stock integer,observed timestamptz)
returns text language plpgsql security invoker set search_path='' as $$
declare previous public.olist_inventory;
begin
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 if physical_stock is null or reserved_stock is null or physical_stock not between -1000000 and 1000000
   or reserved_stock not between 0 and 1000000 or observed is null or observed>clock_timestamp()+interval '1 minute'
   then raise exception 'Invalid inventory snapshot'; end if;
 if not exists(select 1 from public.olist_skus l where l.sku=code and l.remote_id=erp_id and l.state='linked')
   or exists(select 1 from private.product_kit_components where kit_sku=code) then raise exception 'Invalid inventory identity'; end if;
 select * into previous from public.olist_inventory where sku=code for update;
 if previous.observed_at>=observed then return 'stale'; end if;
 insert into public.olist_inventory(sku,physical,reserved,observed_at,checked_at,next_check_at,error)
 values(code,physical_stock,reserved_stock,observed,now(),now()+interval '2 minutes',null)
 on conflict(sku) do update set physical=excluded.physical,reserved=excluded.reserved,observed_at=excluded.observed_at,
 checked_at=now(),next_check_at=excluded.next_check_at,error=null;
 perform private.reconcile_inventory(code);
 perform private.refresh_kit_stock();
 return case when exists(select 1 from public.olist_inventory where sku=code and error is not null) then 'review' else 'synced' end;
end; $$;
revoke all on function public.apply_olist_inventory(text,text,integer,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_olist_inventory(text,text,integer,integer,timestamptz) to service_role;

-- All inventory entry points use the same lock order, including cancellation and snapshot application.
create or replace function public.create_checkout_order(input_user uuid,request jsonb,fingerprint text,payment_fingerprint text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare code text; oid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 -- Existing checkout replays still pass through the original identity checks.
 if exists(select 1 from public.orders where user_id=input_user and request_key=(request->>'key')::uuid) then
   return private.create_checkout_order(input_user,request,fingerprint,payment_fingerprint);
 end if;
 for code in select distinct coalesce(c.component_sku,s.code) from public.checkout_shipping_quotes q,
 lateral jsonb_array_elements(q.products) line
 join private.product_skus s on s.code=line->>'sku'
 left join private.product_kit_components c on c.kit_sku=s.code
 where q.id=(request->>'quoteId')::uuid and q.user_id=input_user loop
   if exists(select 1 from public.olist_inventory v where v.sku=code and v.enabled
     and (v.observed_at is null or v.observed_at<now()-interval '10 minutes' or v.error is not null or private.inventory_ambiguous(code)))
     then raise exception 'Inventory synchronization requires review'; end if;
 end loop;
 oid:=private.create_checkout_order(input_user,request,fingerprint,payment_fingerprint);
 return oid;
end; $$;
create or replace function public.apply_checkout_payment(input_id uuid,provider_id text,next_status text,provider_time timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare h record;
begin
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 perform private.apply_checkout_payment(input_id,provider_id,next_status,provider_time);
 for h in select sku from private.olist_inventory_holds where order_id=input_id loop
   perform private.reconcile_inventory(h.sku);
 end loop;
 perform private.refresh_kit_stock();
end; $$;

-- An operator must verify the ERP movement, not merely the payment or invoice status.
create function public.confirm_olist_inventory(input_order uuid,proof text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 if length(trim(proof)) not between 10 and 500 or proof is null then raise exception 'Movement evidence required'; end if;
 if not exists(select 1 from public.olist_orders e join public.orders o on o.id=e.order_id
   where e.order_id=input_order and e.state='linked' and e.remote_id is not null
   and not o.is_demo and not o.payment_test_mode and o.payment_status='approved') then raise exception 'Order not eligible'; end if;
 update private.olist_inventory_holds set reflected_at=clock_timestamp(),evidence=proof
 where order_id=input_order and reflected_at is null;
 update public.olist_inventory set next_check_at=now(),error='Aguardando leitura posterior à confirmação da baixa.'
 where sku in(select sku from private.olist_inventory_holds where order_id=input_order);
end; $$;
revoke all on function public.confirm_olist_inventory(uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_olist_inventory(uuid,text) to service_role;

alter function private.save_product(integer,integer,jsonb,jsonb,text) rename to save_product_before_inventory;
revoke all on function private.save_product_before_inventory(integer,integer,jsonb,jsonb,text) from authenticated;
create function private.save_product(input_id integer,expected_revision integer,input_document jsonb,input_payload jsonb,legacy_slug text)
returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 if exists(select 1 from private.product_skus s join public.olist_inventory v on v.sku=s.code
   where s.product_id=input_id and v.enabled and not exists(
     select 1 from jsonb_array_elements(input_document->'colors') c,
     lateral jsonb_array_elements(c->'skus') proposed
     where proposed->>'code'=s.code and (proposed->>'stock')::integer=s.stock
       and jsonb_array_length(coalesce(proposed->'components','[]'))=0))
   then raise exception 'Managed inventory must be changed in Olist'; end if;
 return private.save_product_before_inventory(input_id,expected_revision,input_document,input_payload,legacy_slug);
end; $$;
revoke all on function private.save_product(integer,integer,jsonb,jsonb,text) from public,anon;
grant execute on function private.save_product(integer,integer,jsonb,jsonb,text) to authenticated;

create function private.protect_inventory_hold() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.olist_inventory_holds h join public.order_integrations i on i.order_id=h.order_id
   where h.sku=old.code and not i.stock_released and h.reflected_at is null) then
   raise exception 'Unreconciled checkout reserves SKU';
 end if;
 return old;
end; $$;
revoke all on function private.protect_inventory_hold() from public,anon,authenticated;
create trigger protect_inventory_hold before delete on private.product_skus
 for each row execute function private.protect_inventory_hold();
commit;
