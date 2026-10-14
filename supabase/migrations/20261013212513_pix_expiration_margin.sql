-- Pix requires at least 30 minutes from provider emission. Persist a five-minute
-- transport margin at insertion, after any lock wait. Retries keep the same deadline.
-- Existing orders and their payment payloads must not be rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.create_checkout_order(input_user uuid, request jsonb, fingerprint text, payment_fingerprint text)
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
  subtotal,freight,wrapping,upper(trim(request->>'coupon')),option->>'name',option->>'deliveryEstimate','initializing',case when request->>'payment'='pix' then clock_timestamp()+interval '35 minutes' else now()+interval '30 minutes' end,fingerprint);
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

commit;

