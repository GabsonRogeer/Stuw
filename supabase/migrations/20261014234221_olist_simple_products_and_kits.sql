begin;
set local lock_timeout='5s';

create table private.product_kit_components (
  kit_sku text not null references private.product_skus(code) deferrable initially deferred,
  component_sku text not null references private.product_skus(code) deferrable initially deferred,
  quantity integer not null check(quantity between 1 and 100),
  primary key(kit_sku,component_sku), check(kit_sku<>component_sku)
);
create index kit_component_idx on private.product_kit_components(component_sku);
alter table private.product_kit_components enable row level security;
revoke all on private.product_kit_components from public,anon,authenticated;
grant select on private.product_kit_components to service_role;

alter function private.adjust_checkout_stock(integer,text,integer) rename to adjust_unit_stock;
create function private.refresh_kit_stock() returns void language plpgsql security invoker set search_path='' as $$
declare k record; available integer;
begin
  for k in select distinct s.code,s.product_id,s.stock from private.product_skus s
    join private.product_kit_components c on c.kit_sku=s.code order by s.product_id,s.code loop
    select min(case when s.active and p.deleted_at is null and p.document->>'status'='active'
      then s.stock/c.quantity else 0 end) into available
      from private.product_kit_components c join private.product_skus s on s.code=c.component_sku
      join public.admin_products p on p.id=s.product_id where c.kit_sku=k.code;
    if available is distinct from k.stock then
      perform private.adjust_unit_stock(k.product_id,k.code,coalesce(available,0)-k.stock);
    end if;
  end loop;
end; $$;
revoke all on function private.refresh_kit_stock() from public,anon,authenticated;
grant execute on function private.refresh_kit_stock() to service_role;

create function private.adjust_checkout_stock(pid integer,sku text,delta integer) returns void
language plpgsql security invoker set search_path='' as $$
declare component record;
begin
  perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
  if not exists(select 1 from private.product_skus where code=sku and product_id=pid) then raise exception 'SKU mismatch'; end if;
  if exists(select 1 from private.product_kit_components where kit_sku=sku) then
    for component in select s.product_id,s.code,c.quantity from private.product_kit_components c
      join private.product_skus s on s.code=c.component_sku where c.kit_sku=sku order by s.product_id,s.code loop
      perform private.adjust_unit_stock(component.product_id,component.code,delta*component.quantity);
    end loop;
  else
    perform private.adjust_unit_stock(pid,sku,delta);
  end if;
  perform private.refresh_kit_stock();
end; $$;
revoke all on function private.adjust_checkout_stock(integer,text,integer) from public,anon,authenticated;
grant execute on function private.adjust_checkout_stock(integer,text,integer) to service_role;

-- Acquire a common inventory lock BEFORE order/product row locks, including cancellation.
alter function public.create_checkout_order(uuid,jsonb,text,text) set schema private;
create function public.create_checkout_order(input_user uuid,request jsonb,fingerprint text,payment_fingerprint text)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 return private.create_checkout_order(input_user,request,fingerprint,payment_fingerprint);
end; $$;
revoke all on function public.create_checkout_order(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_checkout_order(uuid,jsonb,text,text) to service_role;
alter function public.apply_checkout_payment(uuid,text,text,timestamptz) set schema private;
create function public.apply_checkout_payment(input_id uuid,provider_id text,next_status text,provider_time timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 perform private.apply_checkout_payment(input_id,provider_id,next_status,provider_time);
end; $$;
revoke all on function public.apply_checkout_payment(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_checkout_payment(uuid,text,text,timestamptz) to service_role;

create function private.sync_kit_components(pid integer) returns void language plpgsql security invoker set search_path='' as $$
declare s jsonb; c jsonb;
begin
 delete from private.product_kit_components where kit_sku in(select code from private.product_skus where product_id=pid);
 for s in select sku from public.admin_products p,jsonb_array_elements(p.document->'colors') color,
   lateral jsonb_array_elements(color->'skus') sku where p.id=pid loop
   for c in select value from jsonb_array_elements(coalesce(s->'components','[]')) loop
     if not exists(select 1 from private.product_skus component join private.product_skus kit on kit.code=s->>'code'
       where component.code=c->>'sku' and component.size=kit.size and component.color_slug=kit.color_slug)
       then raise exception 'Kit components must have the same size and color'; end if;
     insert into private.product_kit_components values(s->>'code',c->>'sku',(c->>'quantity')::integer);
   end loop;
 end loop;
 if exists(select 1 from private.product_kit_components a join private.product_kit_components b on a.component_sku=b.kit_sku)
   then raise exception 'Nested kits are not supported'; end if;
 if exists(select 1 from private.product_kit_components c join private.product_skus k on k.code=c.kit_sku
   join private.product_skus s on s.code=c.component_sku where k.size<>s.size or k.color_slug<>s.color_slug)
   then raise exception 'Kit components must have the same size and color'; end if;
 perform private.refresh_kit_stock();
end; $$;
revoke all on function private.sync_kit_components(integer) from public,anon,authenticated,service_role;

alter function private.save_product(integer,integer,jsonb,jsonb,text) rename to save_product_before_kits;
revoke all on function private.save_product_before_kits(integer,integer,jsonb,jsonb,text) from authenticated;
create function private.save_product(input_id integer,expected_revision integer,input_document jsonb,input_payload jsonb,legacy_slug text)
returns integer language plpgsql security definer set search_path='' as $$
declare pid integer;
begin
 if auth.uid() is null or not public.is_admin() then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 delete from private.product_kit_components where kit_sku in(select code from private.product_skus where product_id=input_id);
 pid:=private.save_product_before_kits(input_id,expected_revision,input_document,input_payload,legacy_slug);
 perform private.sync_kit_components(pid);
 return pid;
end; $$;
revoke all on function private.save_product(integer,integer,jsonb,jsonb,text) from public,anon;
grant execute on function private.save_product(integer,integer,jsonb,jsonb,text) to authenticated;

alter function private.archive_product(integer,integer) rename to archive_product_before_kits;
revoke all on function private.archive_product_before_kits(integer,integer) from authenticated;
create function private.archive_product(input_id integer,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_admin() then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 perform private.archive_product_before_kits(input_id,expected_revision);
 perform private.refresh_kit_stock();
end; $$;
revoke all on function private.archive_product(integer,integer) from public,anon;
grant execute on function private.archive_product(integer,integer) to authenticated;

-- Each ERP product now represents one SKU. Existing parent mappings are retained until retired.
alter table public.olist_skus alter column remote_id drop not null;
alter table public.olist_skus add column state text not null default 'linked' check(state in ('pending','linked','blocked','uncertain','conflict')),
 add column attempted_at timestamptz, add column remote_hash text, add column last_error text;
create function public.link_olist_sku(local_id integer,sku_code text,erp_id text,hash_seen text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.admin_products p,jsonb_array_elements(p.document->'colors') c,
   lateral jsonb_array_elements(c->'skus') s where p.id=local_id and s->>'code'=sku_code)
   then raise exception 'SKU mismatch'; end if;
 insert into public.olist_skus(sku,product_id,remote_id,state,remote_hash) values(sku_code,local_id,erp_id,'linked',hash_seen)
   on conflict(sku) do update set remote_id=excluded.remote_id,state='linked',remote_hash=excluded.remote_hash,last_error=null
   where public.olist_skus.product_id=local_id and (public.olist_skus.remote_id is null or public.olist_skus.remote_id=erp_id);
 if not found then raise exception 'SKU identity conflict'; end if;
 update public.olist_products set state=case when exists(select 1 from public.admin_products p,
   jsonb_array_elements(p.document->'colors') c,lateral jsonb_array_elements(c->'skus') s
   where p.id=local_id and not exists(select 1 from public.olist_skus l where l.sku=s->>'code' and l.state='linked'))
   then 'pending' else 'linked' end,last_error=null,updated_at=now() where product_id=local_id;
end; $$;
revoke all on function public.link_olist_sku(integer,text,text,text) from public,anon,authenticated;
grant execute on function public.link_olist_sku(integer,text,text,text) to service_role;
alter function private.import_olist_product(text,jsonb,jsonb,text) rename to import_olist_product_before_kits;
revoke all on function private.import_olist_product_before_kits(text,jsonb,jsonb,text) from service_role;
create function private.import_olist_product(erp_id text,doc jsonb,sku_links jsonb,hash_seen text)
returns integer language plpgsql security definer set search_path='' as $$
declare pid integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 pid:=private.import_olist_product_before_kits(erp_id,doc,sku_links,hash_seen);
 perform private.sync_kit_components(pid);
 return pid;
end; $$;
revoke all on function private.import_olist_product(text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function private.import_olist_product(text,jsonb,jsonb,text) to service_role;
commit;
