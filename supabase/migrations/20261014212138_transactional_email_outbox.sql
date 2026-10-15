-- No historical backfill: only future verified production payment transitions enqueue mail.
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  kind text not null default 'purchase_confirmation' check (kind = 'purchase_confirmation'),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','uncertain','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique(order_id,kind)
);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public,anon,authenticated,service_role;
grant select,update on public.email_outbox to service_role;
create index email_outbox_pending_idx on public.email_outbox(available_at) where status='pending';
create index email_outbox_sending_idx on public.email_outbox(claimed_at) where status='sending';

-- Trigger only: untrusted callers cannot execute it or write to the outbox.
create function private.enqueue_purchase_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_status='approved' and old.payment_status is distinct from 'approved'
     and not new.is_demo and not new.payment_test_mode then
    insert into public.email_outbox(order_id) values(new.id)
    on conflict(order_id,kind) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enqueue_purchase_email() from public,anon,authenticated,service_role;
create trigger enqueue_purchase_email after update of payment_status on public.orders
for each row execute function private.enqueue_purchase_email();
