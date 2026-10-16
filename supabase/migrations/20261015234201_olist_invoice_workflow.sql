begin;
create table public.olist_invoice_jobs (
  order_id uuid primary key references public.olist_orders(order_id),
  invoice_id text unique check (invoice_id ~ '^[1-9][0-9]{0,18}$'),
  status text not null default 'pending' check (status in ('pending','uncertain','generated','processing','authorized','blocked')),
  generate_attempted_at timestamptz,
  emit_attempted_at timestamptz,
  generate_actor uuid references auth.users(id),
  emit_actor uuid references auth.users(id),
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.olist_invoice_jobs enable row level security;
revoke all on public.olist_invoice_jobs from public,anon,authenticated;
grant select on public.olist_invoice_jobs to authenticated;
grant select,insert,update on public.olist_invoice_jobs to service_role;
create policy olist_invoice_admin_read on public.olist_invoice_jobs for select to authenticated using ((select public.is_admin()));
-- Attempts are never reset by the application. A timeout requires remote reconciliation.
create function private.protect_invoice_attempts() returns trigger language plpgsql set search_path='' as $$
begin
  if (old.generate_attempted_at is not null and (new.generate_attempted_at is distinct from old.generate_attempted_at or new.generate_actor is distinct from old.generate_actor))
    or (old.emit_attempted_at is not null and (new.emit_attempted_at is distinct from old.emit_attempted_at or new.emit_actor is distinct from old.emit_actor))
    or (old.invoice_id is not null and new.invoice_id is distinct from old.invoice_id) then
    raise exception 'Invoice attempts and identity are immutable';
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end; $$;
revoke all on function private.protect_invoice_attempts() from public,anon,authenticated,service_role;
create trigger protect_invoice_attempts before update on public.olist_invoice_jobs for each row execute function private.protect_invoice_attempts();
commit;
