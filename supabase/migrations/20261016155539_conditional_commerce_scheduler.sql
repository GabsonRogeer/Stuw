begin;

-- No HTTP, claims, provider calls or queue writes: only a cheap readiness check.
-- Keep this predicate aligned with the existing workers, including recovery work.
create function private.commerce_job_has_work(input_kind text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare cutoff timestamptz;
begin
  case input_kind
    when 'payments' then
      return exists (
        select 1 from public.order_integrations i join public.orders o on o.id=i.order_id
        where i.next_sync_at<now() and not o.is_demo and not o.payment_test_mode
      );
    when 'emails' then
      return exists (select 1 from public.email_outbox where status='pending' and available_at<=now())
        or exists (select 1 from public.email_outbox where status='sending' and claimed_at<now()-interval '10 minutes')
        or exists (
          select 1 from public.olist_invoice_jobs j
          where j.status='authorized' and j.documents_next_attempt_at<=now()
            and not exists(select 1 from public.order_invoice_documents d where d.order_id=j.order_id)
        );
    when 'orders' then
      return exists (select 1 from public.olist_orders where state in ('pending','uncertain'))
        or exists (select 1 from public.olist_orders where state='linked' and updated_at<=now()-interval '5 minutes');
    when 'invoices' then
      select activated_at into cutoff from public.olist_invoice_automation where id and enabled;
      if cutoff is null then return false; end if;
      return exists (
        select 1 from public.olist_invoice_jobs j join public.orders o on o.id=j.order_id
        where j.automatic and j.status not in ('authorized','blocked')
          and o.created_at>=cutoff and j.next_attempt_at<=now()
          and (j.lease_until is null or j.lease_until<now())
      ) or exists (
        -- Newly paid and linked orders must wake the worker BEFORE a job exists.
        select 1 from public.orders o join public.olist_orders l on l.order_id=o.id
        where o.created_at>=cutoff and o.payment_status='approved'
          and not o.is_demo and not o.payment_test_mode and o.total_cents>0
          and l.state='linked' and l.remote_id is not null
          and not exists(select 1 from public.olist_invoice_jobs j where j.order_id=o.id)
      );
    when 'stock' then
      return exists (select 1 from public.olist_inventory where next_check_at<=now())
        or exists (
          -- Bootstrap a newly linked physical SKU without waiting for another SKU.
          select 1 from public.olist_skus l join public.admin_products p on p.id=l.product_id
          where l.state='linked' and l.remote_id is not null and p.deleted_at is null
            and not exists(select 1 from public.olist_inventory v where v.sku=l.sku)
            and not exists(select 1 from private.product_kit_components c where c.kit_sku=l.sku)
        );
    else raise exception 'Unknown commerce job';
  end case;
end; $$;
revoke all on function private.commerce_job_has_work(text) from public,anon,authenticated,service_role;

create index olist_orders_queue_due_idx on public.olist_orders(state,updated_at,order_id)
  where state in ('pending','uncertain','linked');

create or replace function private.run_commerce_job(input_kind text) returns bigint
language plpgsql security invoker set search_path='' as $$
declare secret text; target text; request_id bigint;
begin
  target:=case input_kind
    when 'payments' then 'https://stuw.vercel.app/api/jobs/commerce'
    when 'emails' then 'https://stuw.vercel.app/api/jobs/email'
    when 'orders' then 'https://stuw.vercel.app/api/jobs/olist?direction=orders'
    when 'invoices' then 'https://stuw.vercel.app/api/jobs/olist?direction=invoices'
    else null end;
  if target is null then raise exception 'Unknown commerce job'; end if;
  if not private.commerce_job_has_work(input_kind) then return null; end if;
  -- This is an optimization only. The worker still takes the authoritative lock.
  if input_kind in ('orders','invoices') and exists (
    select 1 from public.olist_cursor where id and locked_until>=now()
  ) then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='stuw_olist_cron_secret';
  if secret is null or length(secret)<32 then raise exception 'Commerce scheduler secret not configured'; end if;
  select net.http_get(url:=target,headers:=jsonb_build_object('Authorization','Bearer '||secret),
    timeout_milliseconds:=case when input_kind='invoices' then 120000 else 50000 end) into request_id;
  insert into private.commerce_job_runs(request_id,kind) values(request_id,input_kind);
  delete from private.commerce_job_runs where started_at<now()-interval '7 days';
  return request_id;
end; $$;
revoke all on function private.run_commerce_job(text) from public,anon,authenticated,service_role;

create or replace function private.run_olist_stock_job() returns bigint
language plpgsql security invoker set search_path='' as $$
declare secret text; request_id bigint;
begin
  if not private.commerce_job_has_work('stock') then return null; end if;
  if exists (select 1 from public.olist_cursor where id and locked_until>=now()) then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='stuw_olist_cron_secret';
  if secret is null or length(secret)<32 then raise exception 'Stock scheduler secret not configured'; end if;
  select net.http_get(
    url:='https://stuw.vercel.app/api/jobs/olist?direction=stock',
    headers:=jsonb_build_object('Authorization','Bearer '||secret),
    timeout_milliseconds:=110000
  ) into request_id;
  insert into private.olist_stock_job_runs(request_id) values(request_id);
  delete from private.olist_stock_job_runs where started_at<now()-interval '7 days';
  return request_id;
end; $$;
revoke all on function private.run_olist_stock_job() from public,anon,authenticated,service_role;

-- Preserve all schedules, activation cutoff, fiscal attempts, leases and stock TTL.
commit;
