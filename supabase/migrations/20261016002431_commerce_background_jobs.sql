begin;
create table private.commerce_job_runs (
  request_id bigint primary key,
  kind text not null check (kind in ('payments','emails','orders')),
  started_at timestamptz not null default now()
);
create index commerce_job_runs_started_idx on private.commerce_job_runs(started_at);
alter table private.commerce_job_runs enable row level security;
revoke all on private.commerce_job_runs from public,anon,authenticated;
grant select on private.commerce_job_runs to service_role;

create function private.run_commerce_job(input_kind text) returns bigint
language plpgsql security invoker set search_path='' as $$
declare secret text; target text; request_id bigint;
begin
  target:=case input_kind
    when 'payments' then 'https://stuw.vercel.app/api/jobs/commerce'
    when 'emails' then 'https://stuw.vercel.app/api/jobs/email'
    when 'orders' then 'https://stuw.vercel.app/api/jobs/olist?direction=orders'
    else null end;
  if target is null then raise exception 'Unknown commerce job'; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='stuw_olist_cron_secret';
  if secret is null or length(secret)<32 then raise exception 'Commerce scheduler secret not configured'; end if;
  select net.http_get(url:=target,headers:=jsonb_build_object('Authorization','Bearer '||secret),timeout_milliseconds:=50000) into request_id;
  insert into private.commerce_job_runs(request_id,kind) values(request_id,input_kind);
  delete from private.commerce_job_runs where started_at<now()-interval '7 days';
  return request_id;
end; $$;
revoke all on function private.run_commerce_job(text) from public,anon,authenticated,service_role;

-- Activate only after verifying HTTP responses against the current deployment.
do $$
declare job bigint;
begin
  select cron.schedule('stuw-commerce-payments','* * * * *',$command$select private.run_commerce_job('payments')$command$) into job;
  perform cron.alter_job(job,active:=false);
  select cron.schedule('stuw-commerce-emails','* * * * *',$command$select private.run_commerce_job('emails')$command$) into job;
  perform cron.alter_job(job,active:=false);
  -- The second run within each minute avoids permanent contention with the stock worker.
  select cron.schedule('stuw-olist-orders','30 seconds',$command$select private.run_commerce_job('orders')$command$) into job;
  perform cron.alter_job(job,active:=false);
end; $$;
commit;
