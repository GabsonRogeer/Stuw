begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- One non-cycling sequence supplies codes without random collision retries.
-- 104729 is coprime to 36^6: the permutation visits every six-character code once.
create sequence private.order_code_sequence as bigint minvalue 1 maxvalue 2176782336 no cycle;
revoke all on sequence private.order_code_sequence from public,anon,authenticated,service_role;

create function private.assign_short_order_number() returns trigger
language plpgsql security definer set search_path='' as $$
declare n bigint; code text; candidate text; alphabet constant text:='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
begin
 -- Preserve imported references and all existing orders. Only the checkout's
 -- generated UUID-shaped number is replaced, before any external integration sees it.
 if new.number !~ '^(STUW|TESTE)-[0-9A-F]{32}$' then return new; end if;
 loop
  n:=((nextval('private.order_code_sequence')-1)*104729+100000000)%2176782336;
  code:='';
  for digit in 1..6 loop
   code:=substr(alphabet,(n%36)::integer+1,1)||code;
   n:=n/36;
  end loop;
  candidate:=(case when new.is_demo then 'TESTE-' else 'STUW-' end)||code;
  exit when not exists(select 1 from public.orders where number=candidate);
 end loop;
 new.number:=candidate;
 return new;
end $$;
revoke all on function private.assign_short_order_number() from public,anon,authenticated,service_role;
create trigger assign_short_order_number before insert on public.orders
 for each row execute function private.assign_short_order_number();
commit;
