-- One-time catalog data correction confirmed by the owner on 2026-10-16.
-- Applies only to the original 21 models. Never changes the R$1 test product,
-- SKUs, prices, stock, published projections, existing quotes or order snapshots.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create temporary table shipping_packages_before on commit drop as
 select id,revision,document from public.admin_products where id between 1000000 and 1000020;

do $$
declare p record; package jsonb; changed_document jsonb;
begin
 perform 1 from public.admin_products where id between 1000000 and 1000020 order by id for update;
 if (select count(*) from public.admin_products where id between 1000000 and 1000020 and deleted_at is null and document->>'status'='active')<>21
  or exists(select 1 from public.admin_products where id between 1000000 and 1000020 and
   case (id-1000000)%3 when 0 then document->>'name' not like 'Top Stuw %'
    when 1 then document->>'name' not like 'Short Stuw %'
    else document->>'name' not like 'Conjunto Stuw %' end)
 then raise exception 'Catalog identity changed; review packaging targets'; end if;

 for p in select * from public.admin_products where id between 1000000 and 1000020 order by id loop
  package:=case (p.id-1000000)%3
   when 0 then jsonb_build_object('length',25,'width',20,'height',3,'weight',150,'shippingPackageIsTest',false)
   when 1 then jsonb_build_object('length',25,'width',22,'height',3,'weight',170,'shippingPackageIsTest',false)
   -- Owner explicitly specified 270 g; do not derive kit packaging from components.
   else jsonb_build_object('length',25,'width',22,'height',6,'weight',270,'shippingPackageIsTest',false) end;
  changed_document:=p.document||package;
  if changed_document=p.document then continue; end if;
  insert into private.product_audit(product_id,revision,document) values(p.id,p.revision,p.document)
   on conflict(product_id,revision) do nothing;
  update public.admin_products set document=changed_document,revision=revision+1,updated_at=now(),updated_by=null where id=p.id;
  insert into private.product_audit(product_id,revision,document) values(p.id,p.revision+1,changed_document);
 end loop;

 if exists(select 1 from public.admin_products ap join shipping_packages_before b using(id)
   where ap.document-array['length','width','height','weight','shippingPackageIsTest']
    is distinct from b.document-array['length','width','height','weight','shippingPackageIsTest'])
 then raise exception 'Unexpected change outside shipping packaging'; end if;
end; $$;

select case (id-1000000)%3 when 0 then 'top' when 1 then 'short' else 'conjunto' end as type,
 count(*) as products,document->'length' as length_cm,document->'width' as width_cm,
 document->'height' as height_cm,document->'weight' as weight_g,document->'shippingPackageIsTest' as test
 from public.admin_products where id between 1000000 and 1000020
 group by 1,3,4,5,6,7 order by 1;
commit;
