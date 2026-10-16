begin;
set local lock_timeout='5s';

-- Read the components reserved at checkout, never the mutable current kit catalog.
create function public.get_olist_invoice_components(input_order uuid)
returns table(sku text, quantity integer)
language sql stable security invoker set search_path='' as $$
 select h.sku,h.quantity
 from private.olist_inventory_holds h
 where h.order_id=input_order
 order by h.sku;
$$;
revoke all on function public.get_olist_invoice_components(uuid) from public,anon,authenticated;
grant execute on function public.get_olist_invoice_components(uuid) to service_role;
commit;
