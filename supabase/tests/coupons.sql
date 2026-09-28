-- Execute as postgres after coupons migration. Everything is rolled back.
begin;
insert into auth.users (id,email) values
 ('f830b3e9-8c74-4a43-88de-ecb31d096001','coupon-admin@example.invalid'),
 ('f830b3e9-8c74-4a43-88de-ecb31d096002','coupon-client@example.invalid');
insert into private.admin_users(user_id) values ('f830b3e9-8c74-4a43-88de-ecb31d096001');
insert into public.coupons(code,percent,max_uses,expires_at) values ('TEST_RLS_ONE',10,1,now()+interval '1 day');
insert into public.coupons(code,percent,max_uses,expires_at,active) values
 ('TEST_RLS_OFF',15,5,now()+interval '1 day',false),
 ('TEST_RLS_EXPIRED',15,5,now()-interval '1 day',true);
insert into public.orders(id,user_id,number,total_cents) values
 ('f830b3e9-8c74-4a43-88de-ecb31d097001','f830b3e9-8c74-4a43-88de-ecb31d096002','COUPON-RLS-1',15500),
 ('f830b3e9-8c74-4a43-88de-ecb31d097002','f830b3e9-8c74-4a43-88de-ecb31d096002','COUPON-RLS-2',15500);
set local role anon;
do $$ begin
 if (select count(*) from public.lookup_coupon(' test_rls_one ')) <> 1 then raise exception 'Guest lookup failed'; end if;
 if exists(select 1 from public.lookup_coupon('TEST_RLS_OFF')) then raise exception 'Inactive coupon exposed'; end if;
 if exists(select 1 from public.lookup_coupon('TEST_RLS_EXPIRED')) then raise exception 'Expired coupon exposed'; end if;
 begin
  perform * from public.coupons;
  raise exception 'Guest can list coupons';
 exception when insufficient_privilege then null; end;
 begin
  perform public.record_coupon_use('TEST_RLS_ONE','f830b3e9-8c74-4a43-88de-ecb31d097001');
  raise exception 'Guest can consume coupon';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d096002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.coupons) then raise exception 'Customer can list coupons'; end if;
 begin
  insert into public.coupons(code,percent,max_uses,expires_at) values ('FORGED',10,10,now()+interval '1 day');
  raise exception 'Customer can create coupons';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d096001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 update public.coupons set active=false where code='TEST_RLS_ONE';
 if exists(select 1 from public.lookup_coupon('TEST_RLS_ONE')) then raise exception 'Deactivation failed'; end if;
 update public.coupons set active=true where code='TEST_RLS_ONE';
 if not exists(select 1 from public.lookup_coupon('TEST_RLS_ONE')) then raise exception 'Reactivation failed'; end if;
 begin
  update public.coupons set used_count=1 where code='TEST_RLS_ONE';
  raise exception 'Admin can forge usage counter';
 exception when insufficient_privilege then null; end;
 begin
  perform public.record_coupon_use('TEST_RLS_ONE','f830b3e9-8c74-4a43-88de-ecb31d097001');
  raise exception 'Admin can consume from browser';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
set local role service_role;
do $$ begin
 if public.record_coupon_use('TEST_RLS_ONE','f830b3e9-8c74-4a43-88de-ecb31d097001') <> 1550 then raise exception 'Wrong total discount'; end if;
 if public.record_coupon_use('TEST_RLS_ONE','f830b3e9-8c74-4a43-88de-ecb31d097001') <> 1550 then raise exception 'Retry failed'; end if;
 if (select used_count from public.coupons where code='TEST_RLS_ONE') <> 1 then raise exception 'Duplicate use'; end if;
 if (select total_cents from public.orders where id='f830b3e9-8c74-4a43-88de-ecb31d097001') <> 13950 then raise exception 'Order total not updated exactly once'; end if;
 begin
  perform public.record_coupon_use('TEST_RLS_ONE','f830b3e9-8c74-4a43-88de-ecb31d097002');
  raise exception 'Limit exceeded';
 exception when raise_exception then
  if sqlerrm <> 'Coupon unavailable' then raise; end if;
 end;
end; $$;
reset role;
set local role anon;
do $$ begin
 if exists(select 1 from public.lookup_coupon('TEST_RLS_ONE')) then raise exception 'Exhausted coupon exposed'; end if;
end; $$;
reset role;
rollback;
