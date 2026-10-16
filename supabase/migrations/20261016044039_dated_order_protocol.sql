begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create sequence private.customer_protocol_sequence as bigint minvalue 1 maxvalue 2176782336 no cycle;
revoke all on sequence private.customer_protocol_sequence from public,anon,authenticated,service_role;
create table private.order_customer_codes (
 user_id uuid primary key references auth.users(id) on delete restrict,
 code text not null unique check(code ~ '^[A-Z0-9]{6}$')
);
create table private.order_protocol_counters (
 user_id uuid not null references private.order_customer_codes(user_id) on delete restrict,
 order_day date not null,
 last_value integer not null check(last_value between 1 and 1295),
 primary key(user_id,order_day)
);
alter table private.order_customer_codes enable row level security;
alter table private.order_protocol_counters enable row level security;
revoke all on private.order_customer_codes,private.order_protocol_counters from public,anon,authenticated,service_role;
grant select on private.order_customer_codes,private.order_protocol_counters to service_role;

create function private.assign_dated_order_protocol() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 n bigint; customer_code text; sequence_code text; candidate text; ordinal integer;
 local_day date:=(coalesce(new.created_at,clock_timestamp()) at time zone 'America/Sao_Paulo')::date;
 alphabet constant text:='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
begin
 -- Only new checkout references change. Preserve historical/imported references and demos.
 if new.is_demo or new.number !~ '^STUW-[0-9A-F]{32}$' then return new; end if;
 if new.user_id is null then raise exception 'Customer identity required for order protocol'; end if;
 select code into customer_code from private.order_customer_codes where user_id=new.user_id;
 if customer_code is null then
  n:=((nextval('private.customer_protocol_sequence')-1)*104729+100000000)%2176782336;
  customer_code:='';
  for digit in 1..6 loop
   customer_code:=substr(alphabet,(n%36)::integer+1,1)||customer_code;
   n:=n/36;
  end loop;
  insert into private.order_customer_codes(user_id,code) values(new.user_id,customer_code)
   on conflict(user_id) do nothing;
  select code into customer_code from private.order_customer_codes where user_id=new.user_id;
 end if;
 loop
  -- The counter's row lock serializes same-customer orders on this day.
  insert into private.order_protocol_counters(user_id,order_day,last_value)
   values(new.user_id,local_day,1)
   on conflict(user_id,order_day) do update set last_value=private.order_protocol_counters.last_value+1
   returning last_value into ordinal;
  sequence_code:=substr(alphabet,(ordinal/36)+1,1)||substr(alphabet,(ordinal%36)+1,1);
  candidate:='STW-'||to_char(local_day,'DDMMYYYY')||customer_code||sequence_code;
  exit when not exists(select 1 from public.orders where number=candidate);
 end loop;
 new.number:=candidate;
 return new;
end; $$;
revoke all on function private.assign_dated_order_protocol() from public,anon,authenticated,service_role;
-- Alphabetical order places this before assign_short_order_number, which preserves
-- the resulting protocol and continues to generate the existing TESTE demo codes.
create trigger assign_order_protocol before insert on public.orders
 for each row execute function private.assign_dated_order_protocol();
commit;
