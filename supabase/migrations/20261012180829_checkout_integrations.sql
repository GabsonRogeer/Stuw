begin;

alter table public.orders
 add column payment_test_mode boolean not null default false,
 add column payment_status text not null default 'pending' check (payment_status in ('initializing','pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back')),
 add column shipment_status text not null default 'pending' check (shipment_status in ('pending','label_generated','shipped','in_transit','delivered','exception','cancelled')),
 add column payment_expires_at timestamptz,
 add column checkout_fingerprint text;
create unique index orders_pending_checkout on public.orders(user_id,checkout_fingerprint) where status='pending' and not is_demo;
create index orders_pending_skus on public.orders using gin(items jsonb_path_ops) where status='pending' and not is_demo;

create table public.checkout_shipping_quotes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 context_hash text not null, products jsonb not null, options jsonb not null,
 expires_at timestamptz not null default now()+interval '15 minutes', created_at timestamptz not null default now()
);
create index checkout_quotes_user_created on public.checkout_shipping_quotes(user_id,created_at desc);
create index checkout_quotes_expiry on public.checkout_shipping_quotes(expires_at);
alter table public.checkout_shipping_quotes enable row level security;
revoke all on public.checkout_shipping_quotes from public,anon,authenticated;
grant all on public.checkout_shipping_quotes to service_role;

create table public.order_integrations (
 order_id uuid primary key references public.orders(id),
 payment_id text unique,
 payment_fingerprint text not null,
 provider_updated_at timestamptz,
 quote_id uuid not null references public.checkout_shipping_quotes(id),
 shipping_service text not null,
 label_id uuid unique,
 stock_released boolean not null default false,
 last_synced_at timestamptz not null default now(),
 next_sync_at timestamptz default now(),
 sync_error text not null default ''
);
create index order_integrations_quote_idx on public.order_integrations(quote_id);
create index order_integrations_sync_idx on public.order_integrations(next_sync_at,order_id) where next_sync_at is not null;
alter table public.order_integrations enable row level security;
revoke all on public.order_integrations from public,anon,authenticated;
grant all on public.order_integrations to service_role;

grant usage on schema private to service_role;
grant select,update on public.admin_products,public.catalog_products to service_role;
grant select on public.product_categories to service_role;
grant select,update on private.product_skus to service_role;
grant select,insert on private.product_audit to service_role;
grant usage on sequence private.product_audit_id_seq to service_role;
grant execute on function private.checkout_product_variant(integer,text,text,integer), private.record_coupon_use(text,uuid) to service_role;
grant select,update on public.coupons to service_role;
grant select,delete on public.coupon_redemptions to service_role;
grant select on auth.users to service_role;

-- save_product replaces its SKU rows. Pending reservations must remain restorable.
create function private.protect_reserved_sku() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.orders where not is_demo and status='pending'
  and items @> jsonb_build_array(jsonb_build_object('sku',old.code))) then
  raise exception 'Pending checkout reserves SKU';
 end if;
 return old;
end; $$;
revoke all on function private.protect_reserved_sku() from public,anon,authenticated;
create trigger protect_reserved_sku before delete on private.product_skus
 for each row execute function private.protect_reserved_sku();

-- Keep editorial stock and both public price projections consistent with the physical stock.
-- Lock product rows in ID order before calling this helper for a basket.
create function private.adjust_checkout_stock(pid integer, sku text, delta integer) returns void
language plpgsql security invoker set search_path='' as $$
declare p public.admin_products; ci integer; si integer; vi integer; stock_now integer; projection text; entry jsonb;
begin
 select * into p from public.admin_products where id=pid for update;
 select (c.ordinality-1)::integer,(s.ordinality-1)::integer into ci,si
 from jsonb_array_elements(p.document->'colors') with ordinality c(value,ordinality)
 cross join lateral jsonb_array_elements(c.value->'skus') with ordinality s(value,ordinality)
 where s.value->>'code'=sku;
 if ci is null or si is null then raise exception 'Inventory changed'; end if;
 update private.product_skus set stock=stock+delta where code=sku and product_id=pid and stock+delta between 0 and 1000000 returning stock into stock_now;
 if not found then raise exception 'Stock unavailable'; end if;
 update public.admin_products set document=jsonb_set(document,array['colors',ci::text,'skus',si::text,'stock'],to_jsonb(stock_now)),
   revision=revision+1,updated_at=now() where id=pid;
 insert into private.product_audit(product_id,revision,document)
 select id,revision,document from public.admin_products where id=pid;
 foreach projection in array array['regular','promotion'] loop
   for entry,vi in select value,(ordinality-1)::integer from public.catalog_products,
     lateral jsonb_array_elements(payload->projection->'variants') with ordinality where id=pid loop
     if entry->>'sku'=sku then
       update public.catalog_products set payload=jsonb_set(payload,array[projection,'variants',vi::text,'stock'],to_jsonb(stock_now)) where id=pid;
     end if;
   end loop;
 end loop;
end; $$;
revoke all on function private.adjust_checkout_stock(integer,text,integer) from public,anon,authenticated;
grant execute on function private.adjust_checkout_stock(integer,text,integer) to service_role;

create function public.create_checkout_order(input_user uuid, request jsonb, fingerprint text, payment_fingerprint text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.orders; q public.checkout_shipping_quotes; option jsonb; line jsonb; variant jsonb; product public.admin_products;
 oid uuid:=gen_random_uuid(); info jsonb:=request->'information'; snapshot jsonb:='[]'; subtotal bigint:=0;
 freight bigint; wrapping bigint:=0; discount bigint:=0; pix bigint:=0; rate numeric:=0; email text; sku text;
begin
 if input_user is null or jsonb_array_length(request->'items') not between 1 and 50 then raise exception 'Invalid checkout'; end if;
 perform pg_advisory_xact_lock(hashtextextended('checkout:'||input_user::text,0));
 select * into existing from public.orders where user_id=input_user and request_key=(request->>'key')::uuid;
 if found then
  if existing.is_demo or existing.checkout_fingerprint is distinct from fingerprint then raise exception 'Checkout changed'; end if;
  return existing.id;
 end if;
 select * into existing from public.orders where user_id=input_user and checkout_fingerprint=fingerprint and status='pending' and not is_demo;
 if found then return existing.id; end if;
 select * into q from public.checkout_shipping_quotes where id=(request->>'quoteId')::uuid and user_id=input_user and expires_at>now();
 if not found then raise exception 'Quote expired'; end if;
 select value into option from jsonb_array_elements(q.options) where value->>'id'=request->>'shipping';
 if option is null then raise exception 'Invalid shipping'; end if;
 if coalesce(request->>'payment','') not in ('pix','card') or (request->>'installments')::integer not between 1 and 6 then raise exception 'Invalid payment'; end if;
 if exists(select 1 from jsonb_array_elements(request->'items') group by value->>'id',value->>'color',value->>'size' having count(*)>1) then raise exception 'Duplicate variant'; end if;
 perform 1 from public.admin_products where id in(select (value->>'id')::integer from jsonb_array_elements(q.products)) order by id for update;
 if jsonb_array_length(q.products)<>jsonb_array_length(request->'items') then raise exception 'Checkout changed'; end if;
 for line in select value from jsonb_array_elements(q.products) order by (value->>'id')::integer loop
  if not exists(select 1 from jsonb_array_elements(request->'items') i where i->>'id'=line->>'id' and i->>'color'=line->>'color' and i->>'size'=line->>'size' and i->>'qty'=line->>'qty') then raise exception 'Checkout changed'; end if;
  select * into product from public.admin_products where id=(line->>'id')::integer;
  if product.deleted_at is not null or product.document->>'status'<>'active' then raise exception 'Product unavailable'; end if;
  variant:=private.checkout_product_variant(product.id,line->>'color',line->>'size',(line->>'qty')::integer);
  if variant is null or (variant->>'price_cents')::bigint<>(line->>'price_cents')::bigint then raise exception 'Total changed'; end if;
  if (product.document->>'weight')::numeric is distinct from (line->>'weight')::numeric
   or (product.document->>'width')::numeric is distinct from (line->>'width')::numeric
   or (product.document->>'height')::numeric is distinct from (line->>'height')::numeric
   or (product.document->>'length')::numeric is distinct from (line->>'length')::numeric then raise exception 'Quote expired'; end if;
  sku:=line->>'sku';
  perform private.adjust_checkout_stock(product.id,sku,-(line->>'qty')::integer);
  subtotal:=subtotal+(line->>'price_cents')::bigint*(line->>'qty')::integer;
  snapshot:=snapshot||jsonb_build_array(line - 'weight' - 'width' - 'height' - 'length');
 end loop;
 freight:=round((option->>'price')::numeric*100);
 if (request->>'gift')::boolean and (request->>'giftWrap')::boolean then wrapping:=3500; end if;
 select u.email into email from auth.users u where u.id=input_user;
 insert into public.orders(id,user_id,number,status,total_cents,is_demo,request_key,customer_name,customer_email,delivery,items,payment_method,installments,gift,
  subtotal_cents,shipping_cents,gift_cents,coupon_code,shipping_name,shipping_estimate,payment_status,payment_expires_at,checkout_fingerprint)
 values(oid,input_user,'STUW-'||upper(replace(oid::text,'-','')),'pending',subtotal+freight+wrapping,false,(request->>'key')::uuid,
  trim(info->>'firstName')||' '||trim(info->>'lastName'),email, info-'emailOffers'-'whatsappOffers'-'email',snapshot,request->>'payment',
  case when request->>'payment'='pix' then 1 else (request->>'installments')::integer end,(request->>'gift')::boolean,
  subtotal,freight,wrapping,upper(trim(request->>'coupon')),option->>'name',option->>'deliveryEstimate','initializing',now()+interval '30 minutes',fingerprint);
 if coalesce(request->>'coupon','')<>'' then
  discount:=private.record_coupon_use(request->>'coupon',oid);
  select percent into rate from public.coupon_redemptions where order_id=oid;
 end if;
 if request->>'payment'='pix' then pix:=round((subtotal-round(subtotal*rate/100))*0.05); end if;
 if (request->>'expectedTotal')::bigint is distinct from subtotal+freight+wrapping-discount-pix then raise exception 'Total changed'; end if;
 if subtotal+freight+wrapping-discount-pix<=0 then raise exception 'Invalid total'; end if;
 update public.orders set total_cents=total_cents-pix,discount_cents=discount,pix_discount_cents=pix,payment_test_mode=not coalesce((request->>'liveMode')::boolean,false) where id=oid;
 insert into public.order_integrations(order_id,payment_fingerprint,quote_id,shipping_service) values(oid,payment_fingerprint,q.id,option->>'id');
 insert into public.order_events(order_id,actor_id,status,note) values(oid,input_user,'pending','Pedido criado. Aguardando confirmação do Mercado Pago.');
 return oid;
end; $$;
revoke all on function public.create_checkout_order(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_checkout_order(uuid,jsonb,text,text) to service_role;

create function public.apply_checkout_payment(input_id uuid, provider_id text, next_status text, provider_time timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.orders; integration public.order_integrations; line jsonb; redemption public.coupon_redemptions;
begin
 select * into o from public.orders where id=input_id and not is_demo for update;
 if not found then raise exception 'Order not found'; end if;
 select * into integration from public.order_integrations where order_id=input_id for update;
 if not found or (integration.payment_id is not null and integration.payment_id<>provider_id) then raise exception 'Payment mismatch'; end if;
 if provider_time is null or (integration.provider_updated_at is not null and provider_time<=integration.provider_updated_at) then return; end if;
 if next_status not in ('pending','in_process','authorized','approved','rejected','cancelled','refunded','charged_back') then raise exception 'Invalid payment status'; end if;
 -- Never revive a terminal failure or regress a confirmed payment from an out-of-order event.
 if o.payment_status in ('approved','refunded','charged_back') and next_status in ('pending','in_process','authorized','rejected','cancelled') then return; end if;
 if integration.stock_released and next_status='approved' then raise exception 'Payment after stock release requires review'; end if;
 if integration.stock_released and next_status in ('pending','in_process','authorized') then return; end if;
 if o.payment_status in ('refunded','charged_back') and next_status='approved' then return; end if;
 update public.order_integrations set payment_id=provider_id,provider_updated_at=provider_time,last_synced_at=now(),sync_error='',
  next_sync_at=case when next_status in ('rejected','cancelled') then null else now()+interval '1 minute' end where order_id=input_id;
 if next_status in ('rejected','cancelled') and not integration.stock_released then
  perform 1 from public.admin_products where id in(select (value->>'id')::integer from jsonb_array_elements(o.items)) order by id for update;
  for line in select value from jsonb_array_elements(o.items) order by (value->>'id')::integer loop
   perform private.adjust_checkout_stock((line->>'id')::integer,line->>'sku',(line->>'qty')::integer);
  end loop;
  select * into redemption from public.coupon_redemptions where order_id=input_id;
  if found then
   update public.coupons set used_count=greatest(0,used_count-1) where id=redemption.coupon_id;
   delete from public.coupon_redemptions where order_id=input_id;
  end if;
  update public.order_integrations set stock_released=true where order_id=input_id;
 end if;
 if o.payment_status=next_status then return; end if;
 update public.orders set payment_status=next_status,status=case
   when next_status='approved' and status='pending' then 'paid'
   when next_status in ('rejected','cancelled') then 'cancelled' else status end,
   revision=revision+1,updated_at=now() where id=input_id;
 insert into public.order_events(order_id,status,note) values(input_id,'payment_'||next_status,'Status confirmado pelo Mercado Pago.');
end; $$;
revoke all on function public.apply_checkout_payment(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_checkout_payment(uuid,text,text,timestamptz) to service_role;

create function public.apply_checkout_shipment(input_id uuid, input_label uuid, next_status text, input_tracking text)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.orders; current_label uuid; ranks text[]:=array['pending','label_generated','shipped','in_transit','delivered'];
begin
 select * into o from public.orders where id=input_id and not is_demo for update;
 if not found then raise exception 'Order not found'; end if;
 select label_id into current_label from public.order_integrations where order_id=input_id for update;
 -- A refund must not stop tracking an already dispatched shipment.
 if current_label is null and o.payment_status<>'approved' then raise exception 'Paid order required'; end if;
 if current_label is not null and current_label<>input_label then raise exception 'Label already linked'; end if;
 if next_status not in ('pending','label_generated','shipped','in_transit','delivered','exception','cancelled') then raise exception 'Invalid shipment status'; end if;
 update public.order_integrations set label_id=input_label,last_synced_at=now(),sync_error='' where order_id=input_id;
 if o.shipment_status='delivered' or (array_position(ranks,next_status)<array_position(ranks,o.shipment_status)) then return; end if;
 if next_status=o.shipment_status and coalesce(input_tracking,'')=o.tracking_code then return; end if;
 update public.orders set shipment_status=next_status,tracking_code=coalesce(nullif(input_tracking,''),tracking_code),carrier=shipping_name,
  status=case when next_status='delivered' then 'delivered' when next_status in ('shipped','in_transit') then 'shipped' else status end,
  revision=revision+1,updated_at=now() where id=input_id;
 if next_status='in_transit' and coalesce(array_position(ranks,o.shipment_status),0)<3 then
  insert into public.order_events(order_id,status,note) values(input_id,'shipment_shipped','Postagem confirmada pelo Melhor Envio.');
 end if;
 insert into public.order_events(order_id,status,note) values(input_id,'shipment_'||next_status,'Atualização confirmada pelo Melhor Envio.');
end; $$;
revoke all on function public.apply_checkout_shipment(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.apply_checkout_shipment(uuid,uuid,text,text) to service_role;

-- Existing demo tools must not bypass provider confirmation for real orders.
-- update_order is SECURITY DEFINER; guard its public entry point as well.
create or replace function public.update_order(input_id uuid,expected_revision integer,next_status text,input_carrier text,input_tracking text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.orders where id=input_id and is_demo) then raise exception 'Provider-managed order'; end if;
 perform private.update_order(input_id,expected_revision,next_status,input_carrier,input_tracking);
end; $$;
-- Direct access to the old private definer is revoked; expose a guarded wrapper only.
revoke execute on function private.update_order(uuid,integer,text,text,text) from authenticated;
-- Wrapper stays invoker; the private function itself enforces both admin identity and demo-only scope.
alter function private.update_order(uuid,integer,text,text,text) rename to update_demo_order_legacy;
create function private.update_order(input_id uuid,expected_revision integer,next_status text,input_carrier text,input_tracking text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise insufficient_privilege; end if;
 if not exists(select 1 from public.orders where id=input_id and is_demo) then raise exception 'Provider-managed order'; end if;
 perform private.update_demo_order_legacy(input_id,expected_revision,next_status,input_carrier,input_tracking);
end; $$;
revoke all on function private.update_order(uuid,integer,text,text,text) from public,anon;
grant execute on function private.update_order(uuid,integer,text,text,text) to authenticated;

commit;
