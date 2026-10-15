begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table private.olist_stock_job_runs (
 request_id bigint primary key,
 started_at timestamptz not null default now()
);
alter table private.olist_stock_job_runs enable row level security;
revoke all on private.olist_stock_job_runs from public,anon,authenticated;
grant select on private.olist_stock_job_runs to service_role;

create function private.run_olist_stock_job() returns bigint
language plpgsql security definer set search_path='' as $$
declare secret text; request_id bigint;
begin
 select decrypted_secret into secret from vault.decrypted_secrets where name='stuw_olist_cron_secret';
 if secret is null then raise exception 'Stock scheduler secret not configured'; end if;
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
do $$
declare job bigint;
begin
 select cron.schedule('stuw-olist-stock','* * * * *','select private.run_olist_stock_job()') into job;
 perform cron.alter_job(job,active:=false);
end; $$;
commit;
