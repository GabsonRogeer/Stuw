begin;
create function private.checkout_pix_discount(input_items jsonb,input_rate numeric) returns bigint
language sql stable security invoker set search_path='' as $$
  with eligible as (
    select coalesce(sum((item->>'price_cents')::bigint*(item->>'qty')::integer),0) as cents
    from jsonb_array_elements(input_items) item
    join public.admin_products p on p.id=(item->>'id')::integer
    where coalesce((p.document->>'pixDiscountEligible')::boolean,true)
  )
  select round((cents-round(cents*coalesce(input_rate,0)/100))*0.05)::bigint from eligible;
$$;
revoke all on function private.checkout_pix_discount(jsonb,numeric) from public,anon,authenticated;
grant execute on function private.checkout_pix_discount(jsonb,numeric) to service_role;

-- Preserve all current validation, locking, expiry and idempotency logic.
do $$
declare definition text; original text:='if request->>''payment''=''pix'' then pix:=round((subtotal-round(subtotal*rate/100))*0.05); end if;';
begin
  definition:=pg_get_functiondef('private.create_checkout_order(uuid,jsonb,text,text)'::regprocedure);
  if position(original in definition)=0 then raise exception 'Checkout implementation changed; review before migrating'; end if;
  execute replace(definition,original,'if request->>''payment''=''pix'' then pix:=private.checkout_pix_discount(snapshot,rate); end if;');
end; $$;

-- Storefront benefits do not change the ERP product or trigger export conflicts.
create or replace function private.olist_content(doc jsonb) returns jsonb language sql immutable set search_path='' as $$
  select (doc-'lastSync'-'colors'-'freeShipping'-'pixDiscountEligible') || jsonb_build_object('colors',coalesce((select jsonb_agg(
    (c-'skus') || jsonb_build_object('skus',(select jsonb_agg(s-'stock') from jsonb_array_elements(c->'skus') s)))
    from jsonb_array_elements(doc->'colors') c),'[]'::jsonb));
$$;
commit;
