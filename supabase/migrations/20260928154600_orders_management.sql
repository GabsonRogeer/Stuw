begin;
-- Trusted catalog for the demonstration checkout. Never accept browser prices.
create table private.checkout_products (
 id integer primary key,
 data jsonb not null,
 active boolean not null default true
);
alter table private.checkout_products enable row level security;
revoke all on private.checkout_products from public, anon, authenticated;
grant all on private.checkout_products to service_role;

alter table public.orders
 add column is_demo boolean not null default false,
 add column request_key uuid,
 add column customer_name text not null default '',
 add column customer_email text not null default '',
 add column delivery jsonb not null default '{}',
 add column items jsonb not null default '[]',
 add column payment_method text not null default '',
 add column installments integer not null default 1 check (installments between 1 and 6),
 add column gift boolean not null default false,
 add column subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
 add column shipping_cents bigint not null default 0 check (shipping_cents >= 0),
 add column gift_cents bigint not null default 0 check (gift_cents >= 0),
 add column discount_cents bigint not null default 0 check (discount_cents >= 0),
 add column pix_discount_cents bigint not null default 0 check (pix_discount_cents >= 0),
 add column coupon_code text not null default '',
 add column shipping_name text not null default '',
 add column shipping_estimate text not null default '',
 add column tracking_code text not null default '' check (char_length(tracking_code) <= 100),
 add column carrier text not null default '' check (char_length(carrier) <= 100),
 add column revision integer not null default 0,
 add column updated_at timestamptz not null default now();
create unique index orders_request_key_idx on public.orders(user_id,request_key);
create index orders_created_idx on public.orders(created_at desc, id);
create index orders_status_created_idx on public.orders(status,created_at desc, id);

create table public.order_events (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null,
 status text not null,
 note text not null default '' check (char_length(note) <= 500),
 created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id,created_at);
create index order_events_actor_idx on public.order_events(actor_id);
alter table public.order_events enable row level security;
revoke all on public.order_events from public, anon, authenticated;
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;
create policy order_events_read on public.order_events for select to authenticated
 using (exists (select 1 from public.orders o where o.id = order_id));

create function private.create_demo_order(request jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 key uuid := (request->>'key')::uuid;
 existing uuid;
 oid uuid := gen_random_uuid();
 info jsonb := request->'information';
 line jsonb;
 product jsonb;
 snapshot jsonb := '[]';
 qty integer;
 price bigint;
 subtotal bigint := 0;
 shipping bigint;
 wrapping bigint := 0;
 discount bigint := 0;
 pix bigint := 0;
 rate numeric := 0;
 code text := upper(trim(coalesce(request->>'coupon','')));
 email text;
begin
 if uid is null then raise insufficient_privilege; end if;
 if key is null or request is null or octet_length(request::text) > 40000 then raise exception 'Invalid request'; end if;
 -- Serialize retries for this account, including simultaneous submissions.
 perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
 select id into existing from public.orders where user_id = uid and request_key = key;
 if found then return existing; end if;
 if jsonb_typeof(request->'items') is distinct from 'array'
 or jsonb_array_length(request->'items') not between 1 and 50 then raise exception 'Invalid cart'; end if;
 if jsonb_typeof(info) is distinct from 'object' or info->>'postalCode' is null
 or (info->>'postalCode') !~ '^\d{5}-?\d{3}$'
 or coalesce(info->>'state','') !~ '^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$'
 or regexp_replace(coalesce(info->>'phone',''),'\D','','g') !~ '^\d{10,11}$'
 then raise exception 'Invalid address'; end if;
 foreach email in array array['firstName','lastName','street','number','district','city'] loop
  if char_length(trim(coalesce(info->>email,''))) not between 1 and 200 then raise exception 'Invalid address'; end if;
 end loop;
 if coalesce(request->>'payment','') not in ('pix','card')
 or coalesce((request->>'installments')::integer,0) not between 1 and 6
 or coalesce(request->>'shipping','') not in ('standard','express') then raise exception 'Invalid checkout'; end if;
 for line in select value from jsonb_array_elements(request->'items') loop
  qty := (line->>'qty')::integer;
  if qty is null or qty not between 1 and 99 then raise exception 'Invalid quantity'; end if;
  select data into product from private.checkout_products where id = (line->>'id')::integer and active;
  if not found or not (product->'sizes' ? coalesce(line->>'size',''))
    or not (product->'colors' ? coalesce(line->>'color','')) then raise exception 'Invalid variant'; end if;
  price := (product->>'price_cents')::bigint;
  subtotal := subtotal + price * qty;
  snapshot := snapshot || jsonb_build_array(jsonb_build_object('id',line->'id','title',product->>'title',
   'image',product->>'image','size',line->>'size','color',line->>'color','qty',qty,'price_cents',price));
 end loop;
 shipping := case when request->>'shipping' = 'express' then 4500 when subtotal >= 49900 then 0 else 2800 end;
 if (request->>'gift')::boolean and (request->>'giftWrap')::boolean then wrapping := 3500; end if;
 select u.email into email from auth.users u where u.id = uid;
 insert into public.orders(id,user_id,number,status,total_cents,is_demo,request_key,customer_name,customer_email,
 delivery,items,payment_method,installments,gift,subtotal_cents,shipping_cents,gift_cents,coupon_code,shipping_name,shipping_estimate)
 values(oid,uid,'TESTE-' || upper(replace(oid::text,'-','')),'pending',subtotal+shipping+wrapping,true,key,
 trim(info->>'firstName') || ' ' || trim(info->>'lastName'),email,
 jsonb_build_object('street',info->>'street','number',info->>'number','complement',coalesce(info->>'complement',''),
 'district',info->>'district','city',info->>'city','state',info->>'state','postalCode',info->>'postalCode','phone',info->>'phone'),snapshot,request->>'payment',
 case when request->>'payment' = 'pix' then 1 else (request->>'installments')::integer end,
 coalesce((request->>'gift')::boolean,false),subtotal,shipping,wrapping,code,
 case when request->>'shipping' = 'express' then 'Entrega expressa' else 'Entrega econômica' end,
 case when request->>'shipping' = 'express' then '2 a 3 dias úteis' else '5 a 8 dias úteis' end);
 if code <> '' then
  discount := private.record_coupon_use(code,oid);
  select percent into rate from public.coupon_redemptions where order_id = oid;
 end if;
 if request->>'payment' = 'pix' then pix := round((subtotal-round(subtotal*rate/100))*0.05); end if;
 if (request->>'expectedTotal')::bigint is distinct from subtotal+shipping+wrapping-discount-pix then
  raise exception 'Total changed';
 end if;
 update public.orders set total_cents=total_cents-pix,discount_cents=discount,pix_discount_cents=pix where id=oid;
 insert into public.order_events(order_id,actor_id,status,note) values(oid,uid,'pending','Pedido de teste registrado. Nenhuma cobrança realizada.');
 return oid;
end; $$;
revoke all on function private.create_demo_order(jsonb) from public, anon, authenticated;
grant execute on function private.create_demo_order(jsonb) to authenticated;
create function public.create_demo_order(request jsonb) returns uuid language sql security invoker set search_path = ''
as $$ select private.create_demo_order(request); $$;
revoke all on function public.create_demo_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_demo_order(jsonb) to authenticated;

create function private.update_order(input_id uuid, expected_revision integer, next_status text, input_carrier text, input_tracking text)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise insufficient_privilege; end if;
 select * into o from public.orders where id=input_id for update;
 if not found then raise exception 'Order not found'; end if;
 if expected_revision is distinct from o.revision then raise exception 'Order changed'; end if;
 if next_status is null or not (next_status=o.status
 or (o.status='pending' and next_status in ('paid','cancelled'))
 or (o.status='paid' and next_status in ('shipped','cancelled'))
 or (o.status='shipped' and next_status='delivered')) then raise exception 'Invalid transition'; end if;
 -- Real payment confirmation must come from the future payment provider.
 if not o.is_demo and next_status='paid' and o.status<>'paid' then raise exception 'Payment provider required'; end if;
 if o.status in ('cancelled','delivered') then raise exception 'Order closed'; end if;
 if next_status in ('shipped','delivered') and (trim(coalesce(input_carrier,''))='' or trim(coalesce(input_tracking,''))='')
 then raise exception 'Tracking required'; end if;
 if o.status=next_status and o.carrier=trim(input_carrier) and o.tracking_code=trim(input_tracking) then return; end if;
 update public.orders set status=next_status,carrier=trim(input_carrier),tracking_code=trim(input_tracking),
 revision=revision+1,updated_at=now() where id=input_id;
 insert into public.order_events(order_id,actor_id,status,note) values(input_id,auth.uid(),next_status,
 case when o.status=next_status then 'Dados de envio atualizados.' else 'Status atualizado pelo administrador.' end);
end; $$;
revoke all on function private.update_order(uuid,integer,text,text,text) from public, anon, authenticated;
grant execute on function private.update_order(uuid,integer,text,text,text) to authenticated;
create function public.update_order(input_id uuid, expected_revision integer, next_status text, input_carrier text, input_tracking text)
returns void language sql security invoker set search_path = '' as $$
 select private.update_order(input_id,expected_revision,next_status,input_carrier,input_tracking);
$$;
revoke all on function public.update_order(uuid,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.update_order(uuid,integer,text,text,text) to authenticated;
-- Generated by node scripts/export-checkout-catalog.cjs. Run after the orders migration.
update private.checkout_products set active=false;
insert into private.checkout_products(id,data,active) values
(1,'{"title":"Legging Sculpt Pure Waist","image":"/products/legging-sculpt-frente.jpg","price_cents":48000,"sizes":["PP","P","M","G","GG"],"colors":["Obsidian Black","Sage Olive","Cashmere Dune"]}'::jsonb,true),
(2,'{"title":"Top Studio Halter Neck Ribbed","image":"/products/top-sage-frente.jpg","price_cents":32000,"sizes":["PP","P","M","G"],"colors":["Sage Olive","Obsidian Black","Cloud Silk"]}'::jsonb,true),
(3,'{"title":"Jaqueta Bomber FeatherTouch Alfaiataria","image":"/products/bomber-taupe-frente.jpg","price_cents":79000,"sizes":["P","M","G"],"colors":["Cashmere Dune","Obsidian Black"]}'::jsonb,true),
(4,'{"title":"Macacão SilkAir One-Piece Catsuit","image":"/products/onesie-mineral-frente.jpg","price_cents":68000,"sizes":["PP","P","M","G"],"colors":["Deep Mineral","Obsidian Black"]}'::jsonb,true),
(5,'{"title":"Saia Plissada Court Tennis Skirt","image":"/products/skirt-tennis-frente.jpg","price_cents":39000,"sizes":["PP","P","M","G"],"colors":["Cloud Silk","Sage Olive"]}'::jsonb,true),
(6,'{"title":"Meias Técnicas de Compressão Anatomic (Par)","image":"/products/fabric-macro.jpg","price_cents":8900,"sizes":["Único"],"colors":["Cloud Silk","Obsidian Black"]}'::jsonb,true),
(7,'{"title":"STUW Mocha Sculpt Set","image":"/products/STUW-Mocha Sculpt-Set-frente.png","price_cents":69000,"sizes":["PP","P","M","G","GG"],"colors":["Mocha"]}'::jsonb,true),
(8,'{"title":"STUW Run Set — Mauve","image":"/products/STUW_Run_Set-Mauve-frente.png","price_cents":49000,"sizes":["PP","P","M","G","GG"],"colors":["Mauve"]}'::jsonb,true),
(10,'{"title":"STUW Move Zip Set","image":"/products/STUW-Move-Zip-Set-frente.png","price_cents":69000,"sizes":["PP","P","M","G","GG"],"colors":["Black"]}'::jsonb,true),
(11,'{"title":"STUW Studio Half-Zip Set","image":"/products/STUW-Studio Half-Zip-Set-frente.png","price_cents":59000,"sizes":["PP","P","M","G","GG"],"colors":["Off-White / Mocha"]}'::jsonb,true),
(12,'{"title":"STUW Active Run Set","image":"/products/STUW-Active-Run-Set-frente.png","price_cents":45000,"sizes":["PP","P","M","G","GG"],"colors":["Black"]}'::jsonb,true),
(13,'{"title":"STUW Sculpt Set Mocha","image":"/products/STUW-Sculpt-Set-Mocha-frente.png","price_cents":65000,"sizes":["PP","P","M","G","GG"],"colors":["Mocha"]}'::jsonb,true)
on conflict(id) do update set data=excluded.data,active=true;

commit;
