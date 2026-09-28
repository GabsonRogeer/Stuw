-- Execute as postgres after the unlimited_coupons migration. Fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('f830b3e9-8c74-4a43-88de-ecb31d099001','unlimited@example.invalid','{}');
insert into public.coupons(code,percent,max_uses,expires_at) values
 ('TEST_UNLIMITED',10,0,now()+interval '1 day');
insert into public.orders(user_id,number,total_cents) values
 ('f830b3e9-8c74-4a43-88de-ecb31d099001','UNLIMITED-ONE',10000),
 ('f830b3e9-8c74-4a43-88de-ecb31d099001','UNLIMITED-TWO',10000),
 ('f830b3e9-8c74-4a43-88de-ecb31d099001','UNLIMITED-THREE',10000);
do $$ declare oid uuid; begin
 if not exists(select 1 from public.lookup_coupon('TEST_UNLIMITED')) then raise exception 'Unlimited lookup unavailable'; end if;
 for oid in select id from public.orders where number in ('UNLIMITED-ONE','UNLIMITED-TWO') loop
  if private.record_coupon_use('TEST_UNLIMITED',oid)<>1000 then raise exception 'Wrong discount'; end if;
  perform private.record_coupon_use('TEST_UNLIMITED',oid);
 end loop;
 if (select used_count from public.coupons where code='TEST_UNLIMITED')<>2 then raise exception 'Unlimited count or retry failed'; end if;
 begin
  update public.coupons set max_uses=1 where code='TEST_UNLIMITED';
  raise exception 'Allowed limit below usage';
 exception when check_violation then null; end;
 update public.coupons set max_uses=2 where code='TEST_UNLIMITED';
 if exists(select 1 from public.lookup_coupon('TEST_UNLIMITED')) then raise exception 'Finite exhausted coupon available'; end if;
 update public.coupons set max_uses=0 where code='TEST_UNLIMITED';
 if not exists(select 1 from public.lookup_coupon('TEST_UNLIMITED')) then raise exception 'Could not restore unlimited'; end if;
 select id into oid from public.orders where number='UNLIMITED-THREE';
 update public.coupons set active=false where code='TEST_UNLIMITED';
 if exists(select 1 from public.lookup_coupon('TEST_UNLIMITED')) then raise exception 'Inactive unlimited available'; end if;
 begin
  perform private.record_coupon_use('TEST_UNLIMITED',oid);
  raise exception 'Inactive unlimited consumed';
 exception when raise_exception then if sqlerrm<>'Coupon unavailable' then raise; end if; end;
 update public.coupons set active=true,expires_at=now()-interval '1 second' where code='TEST_UNLIMITED';
 if exists(select 1 from public.lookup_coupon('TEST_UNLIMITED')) then raise exception 'Expired unlimited available'; end if;
 begin
  perform private.record_coupon_use('TEST_UNLIMITED',oid);
  raise exception 'Expired unlimited consumed';
 exception when raise_exception then if sqlerrm<>'Coupon unavailable' then raise; end if; end;
 if (select used_count from public.coupons where code='TEST_UNLIMITED')<>2 then raise exception 'Rejected use changed counter'; end if;
end; $$;
rollback;
