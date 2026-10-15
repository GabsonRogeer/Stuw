begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
do $$
declare item record;
begin
 if (select count(*) from public.olist_inventory)<>56 then raise exception 'Review inventory scope'; end if;
 if exists(select 1 from public.olist_inventory where observed_at is null or observed_at<now()-interval '10 minutes' or error is not null)
   then raise exception 'Fresh successful snapshots required'; end if;
 if not exists(select 1 from public.olist_inventory where sku='STUW-SHORT-AZUL-M' and physical=5 and reserved=0)
   then raise exception 'Confirmed physical count required'; end if;
 if exists(select 1 from private.olist_inventory_holds h join public.order_integrations i on i.order_id=h.order_id
   where not i.stock_released and h.reflected_at is null and h.sku<>'STUW-SHORT-AZUL-M')
   then raise exception 'Additional opening reservations require review'; end if;
 if exists(select 1 from public.olist_inventory where private.inventory_ambiguous(sku)) then raise exception 'ERP movement review required'; end if;
 update public.olist_inventory set enabled=true;
 for item in select sku from public.olist_inventory order by sku loop
   perform private.reconcile_inventory(item.sku);
 end loop;
 perform private.refresh_kit_stock();
end; $$;
commit;
