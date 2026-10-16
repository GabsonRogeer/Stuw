begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Preserve old customer codes and order references. The decimal identity is only
-- an additional private alias of auth.users.id, never an authentication credential.
alter table private.order_customer_codes
 add column protocol_id bigint generated always as identity,
 add constraint order_customer_codes_protocol_id_key unique(protocol_id),
 add constraint order_customer_codes_protocol_id_positive check(protocol_id>0);
revoke all on sequence private.order_customer_codes_protocol_id_seq from public,anon,authenticated,service_role;
alter table private.order_protocol_counters
 drop constraint order_protocol_counters_last_value_check,
 add constraint order_protocol_counters_last_value_check check(last_value between 1 and 9999);

create or replace function private.assign_dated_order_protocol() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 n bigint; customer_code text; customer_number bigint; candidate text; ordinal integer;
 local_time timestamp:=(coalesce(new.created_at,clock_timestamp()) at time zone 'America/Sao_Paulo');
 alphabet constant text:='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
begin
 if new.is_demo or new.number !~ '^STUW-[0-9A-F]{32}$' then return new; end if;
 if new.user_id is null then raise exception 'Customer identity required for order protocol'; end if;
 select protocol_id into customer_number from private.order_customer_codes where user_id=new.user_id;
 if customer_number is null then
  -- Keep the legacy mapping intact for compatibility with the previous migration.
  n:=((nextval('private.customer_protocol_sequence')-1)*104729+100000000)%2176782336;
  customer_code:='';
  for digit in 1..6 loop
   customer_code:=substr(alphabet,(n%36)::integer+1,1)||customer_code;
   n:=n/36;
  end loop;
  insert into private.order_customer_codes(user_id,code) values(new.user_id,customer_code)
   on conflict(user_id) do nothing;
  select protocol_id into customer_number from private.order_customer_codes where user_id=new.user_id;
 end if;
 loop
  -- Atomic daily sequence; the fixed four-digit suffix keeps the protocol
  -- unambiguous even when customer IDs grow beyond six digits.
  insert into private.order_protocol_counters(user_id,order_day,last_value)
   values(new.user_id,local_time::date,1)
   on conflict(user_id,order_day) do update set last_value=private.order_protocol_counters.last_value+1
   returning last_value into ordinal;
  candidate:='STW-'||to_char(local_time,'DDMMYYYYHH24MI')
   ||lpad(customer_number::text,greatest(6,length(customer_number::text)),'0')
   ||lpad(ordinal::text,4,'0');
  exit when not exists(select 1 from public.orders where number=candidate);
 end loop;
 new.number:=candidate;
 return new;
end; $$;
revoke all on function private.assign_dated_order_protocol() from public,anon,authenticated,service_role;
commit;
