begin;
create table public.wholesale_settings (
 id boolean primary key default true check(id),
 minimum_quantity integer not null default 1 check(minimum_quantity between 1 and 100000),
 whatsapp_number text not null default '' check(whatsapp_number='' or whatsapp_number ~ '^[1-9][0-9]{9,14}$')
);
insert into public.wholesale_settings(id) values(true);
alter table public.wholesale_settings enable row level security;
revoke all on public.wholesale_settings from public,anon,authenticated;
grant select on public.wholesale_settings to anon,authenticated;
grant update(minimum_quantity,whatsapp_number) on public.wholesale_settings to authenticated;
grant all on public.wholesale_settings to service_role;
create policy wholesale_settings_read on public.wholesale_settings for select to anon,authenticated using(true);
create policy wholesale_settings_admin on public.wholesale_settings for update to authenticated
 using((select public.is_admin())) with check((select public.is_admin()));

create table public.wholesale_quotes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 request_key uuid not null,
 number text not null unique,
 status text not null default 'received' check(status in ('received','negotiating','approved','cancelled')),
 customer_name text not null check(char_length(trim(customer_name)) between 1 and 200),
 customer_email text not null,
 phone text not null check(phone ~ '^[0-9]{10,11}$'),
 company text not null default '' check(char_length(company)<=200),
 cnpj text not null default '' check(cnpj='' or cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
 notes text not null default '' check(char_length(notes)<=2000),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 50),
 quantity integer not null check(quantity>0),
 minimum_quantity integer not null check(minimum_quantity>0),
 revision integer not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,request_key)
);
create index wholesale_quotes_user_idx on public.wholesale_quotes(user_id,created_at desc,id);
create index wholesale_quotes_status_idx on public.wholesale_quotes(status,created_at desc,id);
create index wholesale_quotes_created_idx on public.wholesale_quotes(created_at desc,id);
alter table public.wholesale_quotes enable row level security;
revoke all on public.wholesale_quotes from public,anon,authenticated;
grant select on public.wholesale_quotes to authenticated;
grant all on public.wholesale_quotes to service_role;
create policy wholesale_quotes_owner on public.wholesale_quotes for select to authenticated using(user_id=(select auth.uid()));
create policy wholesale_quotes_admin on public.wholesale_quotes for select to authenticated using((select public.is_admin()));

create table public.wholesale_quote_events (
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.wholesale_quotes(id) on delete restrict,
 actor_id uuid references auth.users(id) on delete set null,
 status text not null,
 note text not null check(char_length(note)<=500),
 created_at timestamptz not null default now()
);
create index wholesale_events_quote_idx on public.wholesale_quote_events(quote_id,created_at);
create index wholesale_events_actor_idx on public.wholesale_quote_events(actor_id);
alter table public.wholesale_quote_events enable row level security;
revoke all on public.wholesale_quote_events from public,anon,authenticated;
grant select on public.wholesale_quote_events to authenticated;
grant all on public.wholesale_quote_events to service_role;
create policy wholesale_events_read on public.wholesale_quote_events for select to authenticated
 using(exists(select 1 from public.wholesale_quotes q where q.id=quote_id));

create function private.create_wholesale_quote(request jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid();
 request_id uuid:=(request->>'key')::uuid;
 existing uuid;
 quote_id uuid:=gen_random_uuid();
 minimum integer;
 line jsonb;
 product jsonb;
 snapshot jsonb:='[]';
 qty integer;
 total integer:=0;
 email text;
begin
 if uid is null then raise insufficient_privilege; end if;
 if request_id is null or request is null or octet_length(request::text)>40000 then raise exception 'Invalid request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('wholesale:'||uid::text,0));
 select id into existing from public.wholesale_quotes where user_id=uid and request_key=request_id;
 if found then return existing; end if;
 select minimum_quantity into minimum from public.wholesale_settings where id=true for share;
 if not found then raise exception 'Wholesale unavailable'; end if;
 if jsonb_typeof(request->'items') is distinct from 'array' or jsonb_array_length(request->'items') not between 1 and 50 then raise exception 'Invalid items'; end if;
 for line in select value from jsonb_array_elements(request->'items') loop
  if coalesce(line->>'qty','') !~ '^[0-9]{1,4}$' then raise exception 'Invalid quantity'; end if;
  qty:=(line->>'qty')::integer;
  if qty<1 then raise exception 'Invalid quantity'; end if;
  select data into product from private.checkout_products where id=(line->>'id')::integer and active;
  if not found or not (product->'sizes' ? coalesce(line->>'size','')) or not (product->'colors' ? coalesce(line->>'color','')) then raise exception 'Invalid variant'; end if;
  total:=total+qty;
  snapshot:=snapshot||jsonb_build_array(jsonb_build_object('id',line->'id','title',product->>'title','image',product->>'image','size',line->>'size','color',line->>'color','qty',qty));
 end loop;
 if total<minimum then raise exception 'Minimum quantity: %',minimum; end if;
 select u.email into email from auth.users u where u.id=uid;
 insert into public.wholesale_quotes(id,user_id,request_key,number,customer_name,customer_email,phone,company,cnpj,notes,items,quantity,minimum_quantity)
 values(quote_id,uid,request_id,'ATC-'||upper(replace(quote_id::text,'-','')),trim(request->>'name'),email,
 request->>'phone',trim(coalesce(request->>'company','')),coalesce(request->>'cnpj',''),trim(coalesce(request->>'notes','')),snapshot,total,minimum);
 insert into public.wholesale_quote_events(quote_id,actor_id,status,note) values(quote_id,uid,'received','Solicitação registrada. Valores e disponibilidade sujeitos à negociação.');
 return quote_id;
end; $$;
revoke all on function private.create_wholesale_quote(jsonb) from public,anon,authenticated;
grant execute on function private.create_wholesale_quote(jsonb) to authenticated;
create function public.create_wholesale_quote(request jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.create_wholesale_quote(request); $$;
revoke all on function public.create_wholesale_quote(jsonb) from public,anon,authenticated;
grant execute on function public.create_wholesale_quote(jsonb) to authenticated;

create function private.update_wholesale_quote(input_id uuid,expected_revision integer,next_status text,input_note text) returns void
language plpgsql security definer set search_path='' as $$
declare q public.wholesale_quotes%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise insufficient_privilege; end if;
 select * into q from public.wholesale_quotes where id=input_id for update;
 if not found then raise exception 'Quote not found'; end if;
 if expected_revision is distinct from q.revision then raise exception 'Quote changed'; end if;
 if next_status is null or not ((q.status='received' and next_status in ('negotiating','cancelled')) or (q.status='negotiating' and next_status in ('approved','cancelled'))) then raise exception 'Invalid transition'; end if;
 update public.wholesale_quotes set status=next_status,revision=revision+1,updated_at=now() where id=input_id;
 insert into public.wholesale_quote_events(quote_id,actor_id,status,note) values(input_id,auth.uid(),next_status,coalesce(nullif(trim(input_note),''),'Status atualizado pela STUW.'));
end; $$;
revoke all on function private.update_wholesale_quote(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function private.update_wholesale_quote(uuid,integer,text,text) to authenticated;
create function public.update_wholesale_quote(input_id uuid,expected_revision integer,next_status text,input_note text) returns void
language sql security invoker set search_path='' as $$ select private.update_wholesale_quote(input_id,expected_revision,next_status,input_note); $$;
revoke all on function public.update_wholesale_quote(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.update_wholesale_quote(uuid,integer,text,text) to authenticated;
commit;
