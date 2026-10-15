-- One-time STUW catalog decision: user confirmed fiscal origin 0 for IDs 1000000–1000020.
-- Never defaults new products or changes fiscal values imported from the ERP.
begin;
do $$
begin
  perform 1 from public.admin_products where id between 1000000 and 1000020 for update;
  if (select count(*) from public.admin_products where id between 1000000 and 1000020 and deleted_at is null) <> 21
    or exists(select 1 from public.admin_products where id between 1000000 and 1000020
      and coalesce(document->>'origin','') not in ('','0')) then
    raise exception 'Initial catalog changed; review before assigning fiscal origin';
  end if;
  with changed as (
    update public.admin_products set document=jsonb_set(document,'{origin}','"0"'),
      revision=revision+1,updated_at=now(),updated_by=null
    where id between 1000000 and 1000020 and coalesce(document->>'origin','')=''
    returning id,revision,document
  ) insert into private.product_audit(product_id,revision,document)
    select id,revision,document from changed;
end;
$$;
commit;
