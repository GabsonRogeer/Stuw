begin;
create table public.olist_products (
  product_id integer primary key references public.admin_products(id),
  remote_id text unique check(remote_id ~ '^[1-9][0-9]{0,18}$'),
  state text not null default 'pending' check(state in ('pending','linked','blocked','uncertain','conflict')),
  last_error text,
  attempted_at timestamptz,
  synced_revision integer,
  remote_hash text,
  updated_at timestamptz not null default now()
);
create table public.olist_skus (
  sku text primary key,
  product_id integer not null references public.olist_products(product_id),
  remote_id text not null unique check(remote_id ~ '^[1-9][0-9]{0,18}$')
);
create index olist_skus_product_idx on public.olist_skus(product_id);
create table public.olist_inbox (
  remote_id text primary key check(remote_id ~ '^[1-9][0-9]{0,18}$'),
  name text not null,
  state text not null check(state in ('imported','blocked','conflict','ignored')),
  last_error text,
  remote_hash text,
  updated_at timestamptz not null default now()
);
create table public.olist_cursor (
  id boolean primary key default true check(id),
  page integer not null default 1 check(page > 0),
  position integer not null default 0 check(position >= 0),
  locked_until timestamptz not null default '-infinity',
  owner uuid
);
insert into public.olist_cursor(id) values(true);
alter table public.olist_products enable row level security;
alter table public.olist_skus enable row level security;
alter table public.olist_inbox enable row level security;
alter table public.olist_cursor enable row level security;
revoke all on public.olist_products,public.olist_skus,public.olist_inbox,public.olist_cursor from public,anon,authenticated,service_role;
grant select,insert,update on public.olist_products,public.olist_skus,public.olist_inbox,public.olist_cursor to service_role;
grant select on public.olist_products,public.olist_skus,public.olist_inbox to authenticated;
create policy olist_products_admin on public.olist_products for select to authenticated using((select public.is_admin()));
create policy olist_skus_admin on public.olist_skus for select to authenticated using((select public.is_admin()));
create policy olist_inbox_admin on public.olist_inbox for select to authenticated using((select public.is_admin()));

create function private.olist_content(doc jsonb) returns jsonb language sql immutable set search_path='' as $$
  select (doc-'lastSync'-'colors') || jsonb_build_object('colors', coalesce((select jsonb_agg(
    (c-'skus') || jsonb_build_object('skus',(select jsonb_agg(s-'stock') from jsonb_array_elements(c->'skus') s)))
    from jsonb_array_elements(doc->'colors') c),'[]'::jsonb));
$$;
revoke all on function private.olist_content(jsonb) from public,anon,authenticated;
create function private.queue_olist_product() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    insert into public.olist_products(product_id) values(new.id) on conflict do nothing;
  elsif private.olist_content(new.document) is distinct from private.olist_content(old.document) then
    update public.olist_products set state=case when remote_id is null and attempted_at is null then 'pending' else 'conflict' end,
      last_error=case when remote_id is not null then 'Cadastro alterado no site: revisar diferenças antes de sobrescrever a Olist.' else null end,
      updated_at=now() where product_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_olist_product() from public,anon,authenticated,service_role;
create trigger queue_olist_product after insert or update of document on public.admin_products
for each row execute function private.queue_olist_product();
insert into public.olist_products(product_id) select id from public.admin_products where deleted_at is null on conflict do nothing;

create function public.claim_olist_sync(worker uuid) returns boolean language sql security invoker set search_path='' as $$
  with claimed as (update public.olist_cursor set owner=worker,locked_until=now()+interval '10 minutes'
  where id and locked_until < now() returning id) select exists(select 1 from claimed);
$$;
revoke all on function public.claim_olist_sync(uuid) from public,anon,authenticated;
grant execute on function public.claim_olist_sync(uuid) to service_role;

-- Atomic link creation prevents two catalog identities from sharing an ERP SKU.
create function public.link_olist_product(local_id integer,erp_id text,sku_links jsonb,revision_seen integer,hash_seen text)
returns void language plpgsql security invoker set search_path='' as $$
declare link jsonb; current_revision integer;
begin
  select revision into current_revision from public.admin_products where id=local_id for update;
  if not found then raise exception 'Product missing'; end if;
  update public.olist_products set remote_id=erp_id,state=case when current_revision=revision_seen then 'linked' else 'conflict' end,
    synced_revision=revision_seen,remote_hash=hash_seen,last_error=null,updated_at=now() where product_id=local_id;
  for link in select value from jsonb_array_elements(sku_links) loop
    if not exists(select 1 from public.admin_products p,jsonb_array_elements(p.document->'colors') c,
      jsonb_array_elements(c->'skus') s where p.id=local_id and s->>'code'=link->>'sku') then raise exception 'SKU mismatch'; end if;
    insert into public.olist_skus(sku,product_id,remote_id) values(link->>'sku',local_id,link->>'remote_id')
      on conflict(sku) do update set remote_id=excluded.remote_id
      where public.olist_skus.product_id=excluded.product_id and public.olist_skus.remote_id=excluded.remote_id;
    if not found then raise exception 'SKU identity conflict'; end if;
  end loop;
end;
$$;
revoke all on function public.link_olist_product(integer,text,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.link_olist_product(integer,text,jsonb,integer,text) to service_role;
grant select on public.admin_products to service_role;

-- Import new ERP products as unpublished drafts. Only the server may invoke this function.
create function private.import_olist_product(erp_id text,doc jsonb,sku_links jsonb,hash_seen text)
returns integer language plpgsql security definer set search_path='' as $$
declare pid integer; c jsonb; s jsonb; pos integer:=0;
begin
  perform pg_advisory_xact_lock(hashtextextended('olist:'||erp_id,0));
  select product_id into pid from public.olist_products where remote_id=erp_id;
  if found then return pid; end if;
  if erp_id !~ '^[1-9][0-9]{0,18}$' or doc->>'status' is distinct from 'draft'
    or doc->>'source' is distinct from 'olist' or doc->>'externalId' is distinct from erp_id
    or coalesce(doc->>'name','')='' or coalesce(doc->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or jsonb_typeof(doc->'colors') is distinct from 'array' or jsonb_array_length(doc->'colors') not between 1 and 30
    then raise exception 'Invalid imported draft'; end if;
  insert into public.admin_products(document) values(doc) returning id into pid;
  insert into private.product_slugs(slug,product_id) values(doc->>'slug',pid);
  for c in select value from jsonb_array_elements(doc->'colors') loop
    insert into private.product_colors values(pid,c->>'slug',c-'skus',pos); pos:=pos+1;
    for s in select value from jsonb_array_elements(c->'skus') loop
      if (s->>'stock')::integer <> 0 then raise exception 'Opening stock must be reconciled separately'; end if;
      insert into private.product_identifiers(kind,value,product_id,color_slug,size) values('sku',s->>'code',pid,c->>'slug',s->>'size');
      if nullif(s->>'gtin','') is not null then
        insert into private.product_identifiers(kind,value,product_id,color_slug,size) values('gtin',s->>'gtin',pid,c->>'slug',s->>'size');
      end if;
      insert into private.product_skus(code,product_id,color_slug,size,gtin,stock,price_cents,active)
        values(s->>'code',pid,c->>'slug',s->>'size',nullif(s->>'gtin',''),0,round((s->>'price')::numeric*100),(s->>'active')::boolean);
    end loop;
  end loop;
  insert into private.product_audit(product_id,revision,document) values(pid,1,doc);
  perform public.link_olist_product(pid,erp_id,sku_links,1,hash_seen);
  return pid;
end;
$$;
revoke all on function private.import_olist_product(text,jsonb,jsonb,text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.import_olist_product(text,jsonb,jsonb,text) to service_role;
create function public.import_olist_product(erp_id text,doc jsonb,sku_links jsonb,hash_seen text)
returns integer language sql security invoker set search_path='' as $$ select private.import_olist_product(erp_id,doc,sku_links,hash_seen); $$;
revoke all on function public.import_olist_product(text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.import_olist_product(text,jsonb,jsonb,text) to service_role;
create table public.olist_orders (
  order_id uuid primary key references public.orders(id),
  remote_id text unique check(remote_id ~ '^[1-9][0-9]{0,18}$'),
  tax_document text check(tax_document ~ '^([0-9]{11}|[A-Z0-9]{12}[0-9]{2})$'),
  state text not null default 'waiting_payment' check(state in ('waiting_payment','pending','linked','blocked','uncertain','conflict','cancelled')),
  attempted_at timestamptz,
  invoice_id text,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.olist_orders enable row level security;
revoke all on public.olist_orders from public,anon,authenticated,service_role;
grant select,insert,update on public.olist_orders to service_role;
grant select(order_id,remote_id,state,invoice_id,last_error,updated_at) on public.olist_orders to authenticated;
create policy olist_orders_admin on public.olist_orders for select to authenticated using((select public.is_admin()));
create function public.prepare_olist_order(input_id uuid,input_user uuid,input_document text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.orders where id=input_id and user_id=input_user and not is_demo) then raise insufficient_privilege; end if;
  insert into public.olist_orders(order_id,tax_document,state)
    select id,input_document,case when payment_status='approved' and not payment_test_mode then 'pending' else 'waiting_payment' end
    from public.orders where id=input_id
    on conflict(order_id) do update set tax_document=excluded.tax_document
    where public.olist_orders.tax_document is null or public.olist_orders.tax_document=excluded.tax_document;
  if not found then raise exception 'Fiscal identity mismatch'; end if;
end;
$$;
revoke all on function public.prepare_olist_order(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_olist_order(uuid,uuid,text) to service_role;
create function private.queue_olist_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.is_demo or new.payment_test_mode then return new; end if;
  if new.payment_status='approved' and old.payment_status is distinct from 'approved' then
    insert into public.olist_orders(order_id,state) values(new.id,'pending') on conflict(order_id)
      do update set state='pending',updated_at=now() where public.olist_orders.state='waiting_payment';
  elsif new.payment_status in ('refunded','cancelled','charged_back') and new.payment_status is distinct from old.payment_status then
    update public.olist_orders set state=case when remote_id is null and attempted_at is null then 'cancelled' else 'conflict' end,
      last_error='Pagamento cancelado ou estornado: conferir o pedido e a NF na Olist.',updated_at=now() where order_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_olist_order() from public,anon,authenticated,service_role;
create trigger queue_olist_order after update of payment_status on public.orders for each row execute function private.queue_olist_order();
commit;
