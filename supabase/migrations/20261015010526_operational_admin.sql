begin;
-- Operational staff do not become catalog administrators. Existing admin roles are preserved.
create table public.operation_staff (
 user_id uuid primary key references auth.users(id) on delete restrict,
 role text not null check(role in ('logistics','support','finance','auditor')),
 active boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.operation_staff enable row level security;
revoke all on public.operation_staff from public,anon,authenticated;
grant select on public.operation_staff to authenticated;

create function private.operation_allowed(permission text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
   (permission='team' and public.is_super_admin()) or
   (permission in ('orders','fulfill','returns','finance','stock','audit') and public.is_admin()) or
   exists(select 1 from public.operation_staff s where s.user_id=auth.uid() and s.active and
     (permission='orders' or
      (permission='fulfill' and s.role='logistics') or
      (permission='returns' and s.role in ('support','logistics')) or
      (permission='finance' and s.role='finance') or
      (permission='stock' and s.role in ('logistics','auditor')) or
      (permission='audit' and s.role='auditor')))
 );
$$;
revoke all on function private.operation_allowed(text) from public,anon,authenticated;
grant execute on function private.operation_allowed(text) to authenticated;
create function public.operation_allowed(permission text) returns boolean
language sql stable security invoker set search_path='' as $$ select private.operation_allowed(permission); $$;
revoke all on function public.operation_allowed(text) from public,anon,authenticated;
grant execute on function public.operation_allowed(text) to authenticated;
create policy operation_staff_read on public.operation_staff for select to authenticated
 using(user_id=(select auth.uid()) or (select public.operation_allowed('orders')));
create policy orders_operations_read on public.orders for select to authenticated
 using((select public.operation_allowed('orders')));

create table public.operation_orders (
 order_id uuid primary key references public.orders(id) on delete restrict,
 stage text not null default 'awaiting_pick' check(stage in ('awaiting_pick','picked','checked','invoiced','posted')),
 responsible_id uuid references auth.users(id) on delete restrict,
 evidence text not null default '' check(length(evidence)<=500),
 revision integer not null default 0,
 updated_at timestamptz not null default now()
);
create index operation_orders_responsible_idx on public.operation_orders(responsible_id);
create index operation_orders_queue_idx on public.operation_orders(stage,updated_at);

-- Each entry is a confirmed increase in the provider's cumulative refund amount.
-- It is not an invented provider refund ID or a request to transfer money.
create table public.order_refunds (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete restrict,
 payment_id text not null,
 amount_cents bigint not null check(amount_cents>0),
 cumulative_cents bigint not null check(cumulative_cents>=amount_cents),
 provider_time timestamptz not null,
 source text not null default 'mercado_pago_reconciliation' check(source='mercado_pago_reconciliation'),
 created_at timestamptz not null default now(),
 unique(order_id,cumulative_cents)
);

create table public.order_returns (
 id uuid primary key default gen_random_uuid(),
 request_key uuid not null unique,
 order_id uuid not null references public.orders(id) on delete restrict,
 item_index integer not null check(item_index>=0),
 quantity integer not null check(quantity>0),
 kind text not null check(kind in ('exchange','return')),
 status text not null default 'requested' check(status in ('requested','authorized','received','inspected','completed','rejected')),
 reason text not null check(length(trim(reason)) between 5 and 500),
 resolution text not null default '' check(length(resolution)<=500),
 inspection text not null default '' check(inspection in ('','resalable','damaged')),
 stock_disposition text not null default '' check(stock_disposition in ('','olist_recorded','no_restock')),
 stock_reference text not null default '' check(length(stock_reference)<=200),
 settlement_reference text not null default '' check(length(settlement_reference)<=200),
 responsible_id uuid not null references auth.users(id) on delete restrict,
 revision integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index order_returns_order_idx on public.order_returns(order_id,item_index);
create index order_returns_responsible_idx on public.order_returns(responsible_id);
create index order_returns_queue_idx on public.order_returns(status,created_at);

create table public.operation_audit (
 id bigint generated always as identity primary key,
 entity text not null,
 entity_id text not null,
 order_id uuid references public.orders(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null,
 actor_source text not null,
 action text not null,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz not null default now()
);
create index operation_audit_order_idx on public.operation_audit(order_id,id desc);
create index operation_audit_actor_idx on public.operation_audit(actor_id);

create table public.stock_movements (
 id bigint generated always as identity primary key,
 sku text not null,
 stock_before integer not null,
 stock_after integer not null,
 quantity integer generated always as (stock_after-stock_before) stored,
 kind text not null,
 reason text not null,
 actor_id uuid references auth.users(id) on delete set null,
 order_id uuid references public.orders(id) on delete restrict,
 transaction_id bigint not null default txid_current(),
 created_at timestamptz not null default now()
);
create index stock_movements_sku_idx on public.stock_movements(sku,id desc);
create index stock_movements_order_idx on public.stock_movements(order_id);
create index stock_movements_actor_idx on public.stock_movements(actor_id);
create index stock_movements_unlinked_idx on public.stock_movements(transaction_id)
 where order_id is null and kind in ('reservation','derived_kit');

do $$ declare t text; permission text; begin
 foreach t in array array['operation_orders','order_refunds','order_returns','operation_audit','stock_movements'] loop
  permission:=case t when 'order_refunds' then 'finance' when 'stock_movements' then 'stock' when 'operation_audit' then 'audit' else 'orders' end;
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('create policy operational_read on public.%I for select to authenticated using ((select public.operation_allowed(%L)))',t,permission);
 end loop;
end $$;
grant insert on public.order_refunds to service_role;

create function private.audit_operation() returns trigger language plpgsql security definer set search_path='' as $$
declare n jsonb:=to_jsonb(new); o jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else null end;
begin
 insert into public.operation_audit(entity,entity_id,order_id,actor_id,actor_source,action,before_data,after_data)
 values(tg_table_name,coalesce(n->>'id',n->>'order_id',n->>'user_id'),
   (n->>'order_id')::uuid,auth.uid(),case when auth.uid() is null then 'integration' else 'user' end,tg_op,o,n);
 return new;
end $$;
revoke all on function private.audit_operation() from public,anon,authenticated,service_role;
create trigger operation_orders_audit after insert or update on public.operation_orders for each row execute function private.audit_operation();
create trigger order_returns_audit after insert or update on public.order_returns for each row execute function private.audit_operation();
create trigger order_refunds_audit after insert on public.order_refunds for each row execute function private.audit_operation();
create trigger operation_staff_audit after insert or update on public.operation_staff for each row execute function private.audit_operation();

create function private.change_operation(input_order uuid,expected_revision integer,next_stage text,input_note text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; current_stage public.operation_orders; steps text[]:=array['awaiting_pick','picked','checked','invoiced','posted'];
begin
 if not public.operation_allowed('fulfill') then raise insufficient_privilege; end if;
 select * into o from public.orders where id=input_order for update;
 if not found or o.payment_status<>'approved' or o.status='cancelled' then raise exception 'Approved payment required'; end if;
 if length(trim(coalesce(input_note,''))) not between 5 and 500 or next_stage is null or not(next_stage=any(steps)) then raise exception 'Invalid operation'; end if;
 insert into public.operation_orders(order_id) values(input_order) on conflict do nothing;
 select * into current_stage from public.operation_orders where order_id=input_order for update;
 if current_stage.revision is distinct from expected_revision then raise exception 'Revision conflict'; end if;
 if array_position(steps,next_stage) not in (array_position(steps,current_stage.stage),array_position(steps,current_stage.stage)+1) then raise exception 'Invalid transition'; end if;
 if next_stage='invoiced' and not exists(select 1 from public.olist_orders where order_id=input_order and invoice_id is not null) then raise exception 'Invoice confirmation required'; end if;
 if next_stage='posted' and (o.shipment_status not in ('shipped','in_transit','delivered') or o.tracking_code='') then raise exception 'Shipment confirmation required'; end if;
 update public.operation_orders set stage=next_stage,responsible_id=auth.uid(),evidence=trim(input_note),revision=revision+1,updated_at=now() where order_id=input_order;
end $$;
revoke all on function private.change_operation(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function private.change_operation(uuid,integer,text,text) to authenticated;
create function public.change_operation(input_order uuid,expected_revision integer,next_stage text,input_note text)
returns void language sql security invoker set search_path='' as $$ select private.change_operation(input_order,expected_revision,next_stage,input_note); $$;
revoke all on function public.change_operation(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.change_operation(uuid,integer,text,text) to authenticated;

create function private.manage_return(input_order uuid,input_id uuid,request_key uuid,item_index integer,quantity integer,kind text,next_status text,expected_revision integer,note text,details jsonb default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; r public.order_returns; used integer;
begin
 if not public.operation_allowed('returns') then raise insufficient_privilege; end if;
 if length(trim(coalesce(note,''))) not between 5 and 500 then raise exception 'Reason required'; end if;
 select * into o from public.orders where id=input_order for update;
 if not found then raise exception 'Order not found'; end if;
 if input_id is null then
  select * into r from public.order_returns x where x.request_key=manage_return.request_key;
  if found then
   if r.order_id=input_order and r.item_index=item_index and r.quantity=quantity and r.kind=kind and r.reason=trim(note) then return r.id; end if;
   raise exception 'Request conflict';
  end if;
  if o.shipment_status not in ('shipped','in_transit','delivered') then raise exception 'Shipped order required'; end if;
  if request_key is null or item_index is null or item_index<0 or item_index>=jsonb_array_length(o.items) or quantity is null or quantity<=0 or kind is null or kind not in ('exchange','return') then raise exception 'Invalid item'; end if;
  select coalesce(sum(x.quantity),0) into used from public.order_returns x where x.order_id=input_order and x.item_index=manage_return.item_index and x.status<>'rejected';
  if used+quantity>(o.items->item_index->>'qty')::integer then raise exception 'Quantity exceeds purchased'; end if;
  insert into public.order_returns(request_key,order_id,item_index,quantity,kind,reason,responsible_id)
   values(request_key,input_order,item_index,quantity,kind,trim(note),auth.uid()) returning id into input_id;
 else
  select * into r from public.order_returns where id=input_id and order_id=input_order for update;
  if not found or r.revision is distinct from expected_revision then raise exception 'Revision conflict'; end if;
  if next_status is null or not ((r.status='requested' and next_status in ('authorized','rejected')) or (r.status='authorized' and next_status in ('received','rejected')) or (r.status='received' and next_status='inspected') or (r.status='inspected' and next_status='completed')) then raise exception 'Invalid transition'; end if;
  if next_status='inspected' and coalesce(details->>'inspection','') not in ('resalable','damaged') then raise exception 'Inspection required'; end if;
  if next_status='completed' and (
    coalesce(details->>'stock_disposition','') not in ('olist_recorded','no_restock') or
    (details->>'stock_disposition'='olist_recorded' and length(trim(coalesce(details->>'stock_reference','')))<5) or
    (r.inspection='damaged' and details->>'stock_disposition'<>'no_restock') or
    length(trim(coalesce(details->>'settlement_reference','')))<5
  ) then raise exception 'Resolution evidence required'; end if;
  -- The operator records ERP movement/replacement/refund evidence. This never restocks or transfers money.
  update public.order_returns set status=next_status,resolution=trim(note),responsible_id=auth.uid(),revision=revision+1,updated_at=now(),
   inspection=case when next_status='inspected' then details->>'inspection' else r.inspection end,
   stock_disposition=case when next_status='completed' then details->>'stock_disposition' else r.stock_disposition end,
   stock_reference=case when next_status='completed' then trim(coalesce(details->>'stock_reference','')) else r.stock_reference end,
   settlement_reference=case when next_status='completed' then trim(details->>'settlement_reference') else r.settlement_reference end
   where id=input_id;
 end if;
 return input_id;
end $$;
revoke all on function private.manage_return(uuid,uuid,uuid,integer,integer,text,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function private.manage_return(uuid,uuid,uuid,integer,integer,text,text,integer,text,jsonb) to authenticated;
create function public.manage_return(input_order uuid,input_id uuid,request_key uuid,item_index integer,quantity integer,kind text,next_status text,expected_revision integer,note text,details jsonb default '{}')
returns uuid language sql security invoker set search_path='' as $$ select private.manage_return(input_order,input_id,request_key,item_index,quantity,kind,next_status,expected_revision,note,details); $$;
revoke all on function public.manage_return(uuid,uuid,uuid,integer,integer,text,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_return(uuid,uuid,uuid,integer,integer,text,text,integer,text,jsonb) to authenticated;

create function private.set_operation_staff(input_user uuid,input_role text,input_active boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.operation_allowed('team') then raise insufficient_privilege; end if;
 if exists(select 1 from private.admin_users where user_id=input_user) then raise exception 'Existing administrator'; end if;
 insert into public.operation_staff(user_id,role,active) values(input_user,input_role,input_active)
 on conflict(user_id) do update set role=excluded.role,active=excluded.active,updated_at=now();
end $$;
revoke all on function private.set_operation_staff(uuid,text,boolean) from public,anon,authenticated;
grant execute on function private.set_operation_staff(uuid,text,boolean) to authenticated;
create function public.set_operation_staff(input_user uuid,input_role text,input_active boolean) returns void
language sql security invoker set search_path='' as $$ select private.set_operation_staff(input_user,input_role,input_active); $$;
revoke all on function public.set_operation_staff(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.set_operation_staff(uuid,text,boolean) to authenticated;

create function private.set_operation_staff_email(input_email text,input_role text,input_active boolean) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if not public.operation_allowed('team') then raise insufficient_privilege; end if;
 select id into uid from auth.users where lower(email)=lower(trim(input_email));
 if uid is null then raise exception 'Staff account not found'; end if;
 perform private.set_operation_staff(uid,input_role,input_active);
end $$;
revoke all on function private.set_operation_staff_email(text,text,boolean) from public,anon,authenticated;
grant execute on function private.set_operation_staff_email(text,text,boolean) to authenticated;
create function public.set_operation_staff_email(input_email text,input_role text,input_active boolean) returns void
language sql security invoker set search_path='' as $$ select private.set_operation_staff_email(input_email,input_role,input_active); $$;
revoke all on function public.set_operation_staff_email(text,text,boolean) from public,anon,authenticated;
grant execute on function public.set_operation_staff_email(text,text,boolean) to authenticated;

create function private.operation_people() returns table(user_id uuid,full_name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.operation_allowed('orders') then raise insufficient_privilege; end if;
 return query select p.id,p.full_name from public.profiles p where exists(select 1 from public.operation_staff s where s.user_id=p.id) or exists(select 1 from private.admin_users a where a.user_id=p.id);
end $$;
revoke all on function private.operation_people() from public,anon,authenticated;
grant execute on function private.operation_people() to authenticated;
create function public.operation_people() returns table(user_id uuid,full_name text)
language sql stable security invoker set search_path='' as $$ select * from private.operation_people(); $$;
revoke all on function public.operation_people() from public,anon,authenticated;
grant execute on function public.operation_people() to authenticated;

-- The operational timeline is visible to operators; finance events remain finance-only.
create policy operation_timeline_read on public.operation_audit for select to authenticated
 using ((entity in ('operation_orders','order_returns') and (select public.operation_allowed('orders')))
 or (entity='order_refunds' and (select public.operation_allowed('finance'))));

-- Atomically apply payment and append the confirmed refund delta. Replays and stale events are no-ops.
create function public.reconcile_checkout_payment(input_id uuid,provider_id text,next_status text,provider_time timestamptz,refunded_cents bigint)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.orders; i public.order_integrations; previous bigint; normalized text;
begin
 perform pg_advisory_xact_lock(hashtextextended('stuw:inventory',0));
 select * into o from public.orders where id=input_id and not is_demo for update;
 select * into i from public.order_integrations where order_id=input_id for update;
 if o.id is null or i.order_id is null or (i.payment_id is not null and i.payment_id<>provider_id) then raise exception 'Payment mismatch'; end if;
 if provider_time is null or provider_time<i.provider_updated_at then return; end if;
 if refunded_cents is null or refunded_cents<0 or refunded_cents>o.total_cents then raise exception 'Invalid refund amount'; end if;
 select coalesce(sum(amount_cents),0) into previous from public.order_refunds where order_id=input_id;
 if refunded_cents<previous then raise exception 'Refund regression requires review'; end if;
 normalized:=case when next_status='charged_back' then next_status when refunded_cents=o.total_cents and refunded_cents>0 then 'refunded' else next_status end;
 if refunded_cents>0 and refunded_cents<o.total_cents and next_status not in ('approved','charged_back') then raise exception 'Partial refund requires approved payment'; end if;
 if next_status='refunded' and refunded_cents<>o.total_cents then raise exception 'Refund total mismatch'; end if;
 -- Correct legacy partial-refund normalization only after a fresh provider confirmation.
 if o.payment_status='refunded' and normalized='approved' and refunded_cents>0 and refunded_cents<o.total_cents and provider_time>=i.provider_updated_at then
  update public.orders set payment_status='approved',revision=revision+1,updated_at=now() where id=input_id;
  insert into public.order_events(order_id,status,note) values(input_id,'refund_partial_corrected','Reembolso parcial confirmado pelo provedor; estoque preservado.');
 end if;
 perform public.apply_checkout_payment(input_id,provider_id,normalized,provider_time);
 if refunded_cents>previous then
  insert into public.order_refunds(order_id,payment_id,amount_cents,cumulative_cents,provider_time)
   values(input_id,provider_id,refunded_cents-previous,refunded_cents,provider_time);
 end if;
end $$;
revoke all on function public.reconcile_checkout_payment(uuid,text,text,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.reconcile_checkout_payment(uuid,text,text,timestamptz,bigint) to service_role;

-- Capture changes from the authoritative product document, including admin save/recreated SKUs.
create function private.capture_stock_movement() returns trigger language plpgsql security definer set search_path='' as $$
declare old_skus jsonb; new_skus jsonb; r record; context jsonb;
begin
 old_skus:=case when tg_op='INSERT' then '[]'::jsonb else jsonb_path_query_array(old.document,'$.colors[*].skus[*]') end;
 new_skus:=jsonb_path_query_array(new.document,'$.colors[*].skus[*]');
 context:=coalesce(nullif(current_setting('stuw.stock_context',true),''),'{}')::jsonb;
 for r in select coalesce(a->>'code',b->>'code') sku,coalesce((a->>'stock')::integer,0) before_stock,
   coalesce((b->>'stock')::integer,0) after_stock,coalesce(b->'components',a->'components') components
   from jsonb_array_elements(old_skus) a full join jsonb_array_elements(new_skus) b on a->>'code'=b->>'code'
 loop
  if r.before_stock<>r.after_stock then
   insert into public.stock_movements(sku,stock_before,stock_after,kind,reason,actor_id,order_id)
   values(r.sku,r.before_stock,r.after_stock,case when jsonb_array_length(coalesce(r.components,'[]'))>0 then 'derived_kit' else coalesce(context->>'kind','catalog_adjustment') end,
    coalesce(context->>'reason','Alteração do cadastro de produto'),auth.uid(),(context->>'order_id')::uuid);
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.capture_stock_movement() from public,anon,authenticated,service_role;
create trigger stock_movement_log after insert or update of document on public.admin_products for each row execute function private.capture_stock_movement();

create function private.link_reservation_movements() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.stock_movements set order_id=new.order_id where transaction_id=txid_current() and order_id is null and kind in ('reservation','derived_kit');
 return new;
end $$;
revoke all on function private.link_reservation_movements() from public,anon,authenticated,service_role;
create trigger link_reservation_movements after insert on public.order_integrations for each row execute function private.link_reservation_movements();

create function private.capture_erp_balances() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.physical is not null and new.physical is distinct from old.physical then
  insert into public.stock_movements(sku,stock_before,stock_after,kind,reason) values(new.sku,old.physical,new.physical,'olist_physical','Variação do saldo físico observada na Olist');
 end if;
 if old.reserved is not null and new.reserved is distinct from old.reserved then
  insert into public.stock_movements(sku,stock_before,stock_after,kind,reason) values(new.sku,old.reserved,new.reserved,'olist_reserved','Variação das reservas observada na Olist');
 end if;
 return new;
end $$;
revoke all on function private.capture_erp_balances() from public,anon,authenticated,service_role;
create trigger erp_balance_log after update of physical,reserved on public.olist_inventory for each row execute function private.capture_erp_balances();

-- Preserve all previous locking, idempotency and reconciliation logic; only add transaction-local provenance.
alter function public.create_checkout_order(uuid,jsonb,text,text) rename to create_checkout_order_before_operations;
create function public.create_checkout_order(input_user uuid,request jsonb,fingerprint text,payment_fingerprint text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid; previous text:=current_setting('stuw.stock_context',true);
begin
 perform set_config('stuw.stock_context','{"kind":"reservation","reason":"Reserva no checkout"}',true);
 result:=public.create_checkout_order_before_operations(input_user,request,fingerprint,payment_fingerprint);
 perform set_config('stuw.stock_context',coalesce(previous,''),true);
 return result;
end $$;
revoke all on function public.create_checkout_order(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_checkout_order(uuid,jsonb,text,text) to service_role;

alter function public.apply_checkout_payment(uuid,text,text,timestamptz) rename to apply_checkout_payment_before_operations;
create function public.apply_checkout_payment(input_id uuid,provider_id text,next_status text,provider_time timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare previous text:=current_setting('stuw.stock_context',true);
begin
 perform set_config('stuw.stock_context',jsonb_build_object('kind','payment_reconciliation','reason','Conciliação do pagamento: '||next_status,'order_id',input_id)::text,true);
 perform public.apply_checkout_payment_before_operations(input_id,provider_id,next_status,provider_time);
 perform set_config('stuw.stock_context',coalesce(previous,''),true);
end $$;
revoke all on function public.apply_checkout_payment(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_checkout_payment(uuid,text,text,timestamptz) to service_role;

alter function public.apply_olist_inventory(text,text,integer,integer,timestamptz) rename to apply_olist_inventory_before_operations;
create function public.apply_olist_inventory(code text,erp_id text,physical_stock integer,reserved_stock integer,observed timestamptz)
returns text language plpgsql security invoker set search_path='' as $$
declare result text; previous text:=current_setting('stuw.stock_context',true);
begin
 perform set_config('stuw.stock_context','{"kind":"olist_reconciliation","reason":"Saldo disponível conciliado com a Olist"}',true);
 result:=public.apply_olist_inventory_before_operations(code,erp_id,physical_stock,reserved_stock,observed);
 perform set_config('stuw.stock_context',coalesce(previous,''),true);
 return result;
end $$;
revoke all on function public.apply_olist_inventory(text,text,integer,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_olist_inventory(text,text,integer,integer,timestamptz) to service_role;
commit;
