-- User-approved migration of the 21 existing STUW models: P/M/G/GG, GG zero,
-- kits consume one top and one short of matching color/size. Existing reservations remain intact.
begin;
select pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
do $$
declare p record; c jsonb; s jsonb; gg jsonb; colors jsonb; skus jsonb; doc jsonb;
 projection text; public_payload jsonb; variants jsonb; v jsonb;
begin
 if (select count(*) from public.admin_products where id between 1000000 and 1000020 and deleted_at is null)<>21
   then raise exception 'Initial catalog changed'; end if;
 if exists(select 1 from public.orders o,jsonb_array_elements(o.items) i where o.status='pending' and i->>'sku' like 'STUW-CONJ-%')
   then raise exception 'Pending kit order must be reconciled first'; end if;
 for p in select * from public.admin_products where id between 1000000 and 1000020 order by id for update loop
   doc:=p.document; colors:='[]';
   for c in select value from jsonb_array_elements(doc->'colors') loop
     skus:=c->'skus';
     if not exists(select 1 from jsonb_array_elements(skus) x where x->>'size'='GG') then
       gg:=(skus->0)||jsonb_build_object('size','GG','code',regexp_replace(skus->0->>'code','-(P|M|G)$','-GG'),'gtin','','stock',0);
       skus:=skus||jsonb_build_array(gg);
       insert into private.product_identifiers(kind,value,product_id,color_slug,size) values('sku',gg->>'code',p.id,c->>'slug','GG');
       insert into private.product_skus(code,product_id,color_slug,size,stock,price_cents,active)
         values(gg->>'code',p.id,c->>'slug','GG',0,round((gg->>'price')::numeric*100),(gg->>'active')::boolean);
     end if;
     if p.id in (1000002,1000005,1000008,1000011,1000014,1000017,1000020) then
       select jsonb_agg(x||jsonb_build_object('components',jsonb_build_array(
         jsonb_build_object('sku',replace(x->>'code','STUW-CONJ-','STUW-TOP-'),'quantity',1),
         jsonb_build_object('sku',replace(x->>'code','STUW-CONJ-','STUW-SHORT-'),'quantity',1)))) into skus
         from jsonb_array_elements(skus) x;
     end if;
     colors:=colors||jsonb_build_array(c||jsonb_build_object('skus',skus));
   end loop;
   doc:=doc||jsonb_build_object('colors',colors,'sizes',jsonb_build_array('P','M','G','GG'));
   update public.admin_products set document=doc,revision=revision+1,updated_at=now(),updated_by=null where id=p.id;
   insert into private.product_audit(product_id,revision,document) select id,revision,document from public.admin_products where id=p.id;
   select cp.payload into public_payload from public.catalog_products cp where cp.id=p.id;
   if public_payload is not null then
     foreach projection in array array['regular','promotion'] loop
       variants:=public_payload->projection->'variants';
       for v in select value from jsonb_array_elements(variants) x where x->>'size'='G' loop
         if not exists(select 1 from jsonb_array_elements(variants) x where x->>'color'=v->>'color' and x->>'size'='GG') then
           variants:=variants||jsonb_build_array(v||jsonb_build_object('size','GG','sku',regexp_replace(v->>'sku','-G$','-GG'),'stock',0));
         end if;
       end loop;
       public_payload:=jsonb_set(public_payload,array[projection,'variants'],variants);
       public_payload:=jsonb_set(public_payload,array[projection,'sizes'],jsonb_build_array('P','M','G','GG'));
     end loop;
     update public.catalog_products cp set payload=public_payload where cp.id=p.id;
   end if;
 end loop;
 for p in select id from public.admin_products where id between 1000000 and 1000020 order by id loop
   perform private.sync_kit_components(p.id);
 end loop;
end; $$;
commit;
