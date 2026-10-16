begin;
set local lock_timeout='5s';

alter table public.olist_invoice_jobs add column documents_next_attempt_at timestamptz not null default now();
alter table public.olist_invoice_jobs add column document_error text;
create index invoice_documents_due on public.olist_invoice_jobs(documents_next_attempt_at,order_id) where status='authorized';

create table public.order_invoice_documents (
 order_id uuid primary key references public.olist_invoice_jobs(order_id) on delete restrict,
 invoice_id text not null unique check(invoice_id ~ '^[1-9][0-9]{0,18}$'),
 number text not null check(number ~ '^[0-9]{1,9}$'),
 series text not null check(series ~ '^[0-9]{1,3}$'),
 access_key text not null unique check(access_key ~ '^[0-9]{44}$'),
 total_cents integer not null check(total_cents>0),
 authorized_at timestamptz not null,
 pdf_path text not null check(pdf_path=order_id::text||'/'||invoice_id||'/'||pdf_sha256||'.pdf'),
 xml_path text not null check(xml_path=order_id::text||'/'||invoice_id||'/'||xml_sha256||'.xml'),
 pdf_sha256 text not null check(pdf_sha256 ~ '^[a-f0-9]{64}$'),
 xml_sha256 text not null check(xml_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
alter table public.order_invoice_documents enable row level security;
revoke all on public.order_invoice_documents from public,anon,authenticated,service_role;
grant select,insert on public.order_invoice_documents to service_role;
grant select(order_id,number,series,total_cents,authorized_at) on public.order_invoice_documents to authenticated;
create policy invoice_document_owner_read on public.order_invoice_documents for select to authenticated
 using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())) or (select public.is_admin()));

create function private.validate_invoice_document() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.olist_invoice_jobs j join public.orders o on o.id=j.order_id
  where j.order_id=new.order_id and j.invoice_id=new.invoice_id and j.status='authorized'
  and not o.is_demo and not o.payment_test_mode and o.total_cents=new.total_cents) then
  raise exception 'Authorized invoice identity or total does not match';
 end if;
 return new;
end; $$;
revoke all on function private.validate_invoice_document() from public,anon,authenticated;
grant execute on function private.validate_invoice_document() to service_role;
create trigger validate_invoice_document before insert on public.order_invoice_documents
 for each row execute function private.validate_invoice_document();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('order-invoices','order-invoices',false,4194304,array['application/pdf','application/xml']);
-- No customer Storage policies: files are streamed only after checking order ownership.

alter table public.email_outbox drop constraint email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check
 check(kind in('purchase_confirmation','invoice_available'));

create function private.enqueue_invoice_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.email_outbox(order_id,kind) values(new.order_id,'invoice_available')
 on conflict(order_id,kind) do nothing;
 return new;
end; $$;
revoke all on function private.enqueue_invoice_email() from public,anon,authenticated,service_role;
create trigger enqueue_invoice_email after insert on public.order_invoice_documents
 for each row execute function private.enqueue_invoice_email();
commit;
