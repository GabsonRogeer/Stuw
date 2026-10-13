-- One-time data operation requested by the owner. NOT a schema migration.
-- Generate with scripts/prepare-production-catalog.cjs, back up, then use --guard.
-- Requires a privileged database connection. No new grants or public RPCs.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- LOCK_TABLES
-- SNAPSHOT_GUARD
create temporary table new_catalog_documents(document jsonb not null) on commit drop;
-- PRODUCT_DOCUMENTS

-- Never silently replace an existing product with one of the requested slugs.
do $$ begin
  if exists(select 1 from private.product_slugs s join new_catalog_documents n on s.slug=n.document->>'slug')
    or exists(select 1 from public.admin_products p join new_catalog_documents n on p.document->>'slug'=n.document->>'slug') then
    raise exception 'Um slug do novo catálogo já existe. Operação cancelada; não executar novamente.';
  end if;
end $$;

-- Remove dependent records first; do not cascade into profiles, addresses or users.
delete from public.order_integrations;
delete from public.order_events;
update public.coupons c set used_count=greatest(0,c.used_count-r.n)
from (select coupon_id,count(*)::integer n from public.coupon_redemptions group by coupon_id) r
where c.id=r.coupon_id;
delete from public.coupon_redemptions;
delete from public.orders;
delete from public.checkout_shipping_quotes;
delete from public.wholesale_quote_events;
delete from public.wholesale_quotes;
delete from public.catalog_products;
delete from private.checkout_products;
delete from private.product_skus;
delete from private.product_colors;
delete from private.product_identifiers;
delete from private.product_slugs;
delete from private.product_audit;
delete from private.product_wholesale_terms;
delete from public.admin_products;
delete from public.product_categories;

insert into public.product_categories(kind,label,value,position) values
('piece','Tops/Croppeds','Tops/Croppeds',0),
('piece','Shorts','Shorts',1),
('piece','Conjuntos','Conjuntos',2),
('activity','Training','Activewear / Training',0);

-- Keep identity sequences advancing: old carts/links must never resolve to new products.
do $$
declare doc jsonb; pid integer; c jsonb; s jsonb;
begin
  for doc in select document from new_catalog_documents loop
    insert into public.admin_products(document) values(doc) returning id into pid;
    insert into private.product_slugs(slug,product_id) values(doc->>'slug',pid);
    for c in select value from jsonb_array_elements(doc->'colors') loop
      insert into private.product_colors(product_id,slug,data,position) values(pid,c->>'slug',c-'skus',0);
      for s in select value from jsonb_array_elements(c->'skus') loop
        insert into private.product_skus(code,product_id,color_slug,size,gtin,stock,price_cents,active)
        values(s->>'code',pid,c->>'slug',s->>'size',null,0,null,true);
        insert into private.product_identifiers(kind,value,product_id,color_slug,size)
        values('sku',s->>'code',pid,c->>'slug',s->>'size');
      end loop;
    end loop;
    -- System import: no administrator identity is fabricated.
    insert into private.product_audit(product_id,actor_id,revision,document) values(pid,null,1,doc);
  end loop;
  if (select count(*) from public.admin_products)<>21 or (select count(*) from private.product_skus)<>63 then
    raise exception 'Quantidade inesperada de produtos/SKUs';
  end if;
end $$;
commit;

select (select count(*) from public.admin_products) as products,
       (select count(*) from private.product_skus) as skus,
       (select count(*) from public.orders) as orders,
       (select count(*) from public.wholesale_quotes) as wholesale_quotes,
       (select count(*) from public.catalog_products) as published;
