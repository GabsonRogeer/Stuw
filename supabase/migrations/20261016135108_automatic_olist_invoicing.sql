begin;

-- Disabled until the worker is deployed and verified. The activation cutoff prevents
-- previously paid orders (including controlled purchases) from entering the queue.
create table public.olist_invoice_automation (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  activated_at timestamptz,
  check (not enabled or activated_at is not null)
);
insert into public.olist_invoice_automation(id) values(true);
alter table public.olist_invoice_automation enable row level security;
revoke all on public.olist_invoice_automation from public,anon,authenticated;
grant select on public.olist_invoice_automation to authenticated;
grant select,update on public.olist_invoice_automation to service_role;
create policy invoice_automation_admin_read on public.olist_invoice_automation
  for select to authenticated using ((select public.is_admin()));

alter table public.olist_invoice_jobs
  add column automatic boolean not null default false,
  add column automation_attempts integer not null default 0 check (automation_attempts>=0),
  add column validated_skus text[] not null default '{}',
  add column next_attempt_at timestamptz not null default now(),
  add column lease_owner uuid,
  add column lease_until timestamptz,
  add constraint invoice_lease_pair check ((lease_owner is null)=(lease_until is null));
create index invoice_automatic_due_idx on public.olist_invoice_jobs(next_attempt_at,order_id)
  where automatic and status not in ('authorized','blocked');
create index orders_invoice_candidates_idx on public.orders(created_at,id)
  where payment_status='approved' and not is_demo and not payment_test_mode;

-- Queue and claim in a short transaction; no provider calls hold database locks.
-- Invoker permissions and service-only EXECUTE keep customers out of the queue.
create function public.claim_automatic_olist_invoice(worker uuid)
returns setof public.olist_invoice_jobs
language plpgsql security invoker set search_path='' as $$
declare cutoff timestamptz;
begin
  if worker is null then raise exception 'Worker is required'; end if;
  select activated_at into cutoff from public.olist_invoice_automation where id and enabled;
  if cutoff is null then return; end if;

  insert into public.olist_invoice_jobs(order_id,automatic)
  select o.id,true from public.orders o
  join public.olist_orders l on l.order_id=o.id
  where o.created_at>=cutoff and o.payment_status='approved'
    and not o.is_demo and not o.payment_test_mode and o.total_cents>0
    and l.state='linked' and l.remote_id is not null
    and not exists(select 1 from public.olist_invoice_jobs j where j.order_id=o.id)
  order by o.created_at,o.id limit 100
  on conflict(order_id) do nothing;

  return query
  with candidate as (
    select j.order_id from public.olist_invoice_jobs j
    join public.orders o on o.id=j.order_id
    where j.automatic and j.status not in ('authorized','blocked')
      and o.created_at>=cutoff and j.next_attempt_at<=now()
      and (j.lease_until is null or j.lease_until<now())
    order by j.next_attempt_at,j.order_id
    for update of j skip locked limit 1
  )
  update public.olist_invoice_jobs j
  set lease_owner=worker,lease_until=now()+interval '3 minutes',
      automation_attempts=j.automation_attempts+1
  from candidate c where j.order_id=c.order_id returning j.*;
end; $$;
revoke all on function public.claim_automatic_olist_invoice(uuid) from public,anon,authenticated;
grant execute on function public.claim_automatic_olist_invoice(uuid) to service_role;

alter table private.commerce_job_runs drop constraint commerce_job_runs_kind_check;
alter table private.commerce_job_runs add constraint commerce_job_runs_kind_check
  check (kind in ('payments','emails','orders','invoices'));
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
  select decrypted_secret into secret from vault.decrypted_secrets where name='stuw_olist_cron_secret';
  if secret is null or length(secret)<32 then raise exception 'Commerce scheduler secret not configured'; end if;
  select net.http_get(url:=target,headers:=jsonb_build_object('Authorization','Bearer '||secret),
    timeout_milliseconds:=case when input_kind='invoices' then 120000 else 50000 end) into request_id;
  insert into private.commerce_job_runs(request_id,kind) values(request_id,input_kind);
  delete from private.commerce_job_runs where started_at<now()-interval '7 days';
  return request_id;
end; $$;
revoke all on function private.run_commerce_job(text) from public,anon,authenticated,service_role;
do $$
declare job bigint;
begin
  select cron.schedule('stuw-olist-invoices','30 seconds',
    $command$select private.run_commerce_job('invoices')$command$) into job;
  perform cron.alter_job(job,active:=false);
end; $$;
commit;
