-- Run after the orders migration as postgres. All fixtures are rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('f830b3e9-8c74-4a43-88de-ecb31d098001','orders-one@example.invalid','{}'),
 ('f830b3e9-8c74-4a43-88de-ecb31d098002','orders-two@example.invalid','{}'),
 ('f830b3e9-8c74-4a43-88de-ecb31d098003','orders-admin@example.invalid','{}');
insert into private.admin_users(user_id,role) values('f830b3e9-8c74-4a43-88de-ecb31d098003','admin');
insert into public.coupons(code,percent,max_uses,expires_at) values('ORDERS_TEST_10',10,1,now()+interval '1 day');
insert into public.coupons(code,percent,max_uses,expires_at) values('ORDERS_ROLLBACK',10,1,now()+interval '1 day');
-- Dedicated catalog entry keeps tests independent of future product prices.
insert into private.checkout_products(id,data) values(999999,'{"title":"Test item","image":"/products/test.jpg","price_cents":48000,"sizes":["M"],"colors":["Black"]}');
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d098001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare req jsonb := '{"key":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","items":[{"id":999999,"size":"M","color":"Black","qty":1,"price":1}],"information":{"firstName":"Test","lastName":"Customer","postalCode":"01001000","street":"Rua A","number":"1","district":"Centro","city":"São Paulo","state":"SP","phone":"11999999999"},"payment":"pix","installments":1,"shipping":"standard","gift":false,"giftWrap":false,"coupon":"ORDERS_TEST_10","expectedTotal":43560}';
 oid uuid;
begin
 oid := public.create_demo_order(req);
 perform set_config('test.order_id',oid::text,true);
 if public.create_demo_order(req) <> oid then raise exception 'Retry duplicated order'; end if;
 if (select count(*) from public.orders where id=oid)<>1 then raise exception 'Owner cannot read order'; end if;
 if not exists(select 1 from public.orders where id=oid and user_id=auth.uid() and total_cents=43560 and subtotal_cents=48000 and discount_cents=5080 and pix_discount_cents=2160 and is_demo and status='pending') then raise exception 'Trusted totals or ownership failed'; end if;
 if (select count(*) from public.order_events where order_id=oid)<>1 then raise exception 'Missing event'; end if;
 begin
  perform public.create_demo_order(req || '{"key":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}');
  raise exception 'Allowed exhausted coupon';
 exception when raise_exception then if sqlerrm <> 'Coupon unavailable' then raise; end if; end;
 begin
  perform public.create_demo_order(req || '{"key":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","coupon":"","expectedTotal":1}');
  raise exception 'Allowed forged total';
 exception when raise_exception then if sqlerrm <> 'Total changed' then raise; end if; end;
 begin
  perform public.create_demo_order(req || '{"key":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","coupon":"ORDERS_ROLLBACK","expectedTotal":1}');
  raise exception 'Allowed forged coupon total';
 exception when raise_exception then if sqlerrm <> 'Total changed' then raise; end if; end;
 begin
  perform public.create_demo_order(req || '{"key":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","items":[{"id":999999,"size":"INVALID","color":"Black","qty":1}]}');
  raise exception 'Allowed forged variant';
 exception when raise_exception then if sqlerrm <> 'Invalid variant' then raise; end if; end;
 begin
  perform public.update_order(oid,0,'paid','','');
  raise exception 'Customer changed status';
 exception when insufficient_privilege then null; end;
 begin
  update public.orders set status='paid' where id=oid;
  raise exception 'Customer updated table';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
do $$ begin
 if (select used_count from public.coupons where code='ORDERS_TEST_10')<>1 then raise exception 'Counter incorrect'; end if;
 if (select used_count from public.coupons where code='ORDERS_ROLLBACK')<>0 then raise exception 'Failed checkout consumed coupon'; end if;
 if (select count(*) from public.orders where user_id='f830b3e9-8c74-4a43-88de-ecb31d098001')<>1 then raise exception 'Failed request leaked partial order'; end if;
end; $$;
update private.checkout_products set data=jsonb_set(data,'{price_cents}','99999') where id=999999;
do $$ begin
 if (select items->0->>'price_cents' from public.orders where id=current_setting('test.order_id')::uuid)<>'48000' then raise exception 'Catalog changed historical price'; end if;
end; $$;
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d098002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.orders where id=current_setting('test.order_id')::uuid) then raise exception 'Cross-account order leak'; end if;
 if exists(select 1 from public.order_events where order_id=current_setting('test.order_id')::uuid) then raise exception 'Cross-account history leak'; end if;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d098003","role":"authenticated"}',true);
set local role authenticated;
do $$ declare oid uuid := current_setting('test.order_id')::uuid;
begin
 if not exists(select 1 from public.orders where id=oid) then raise exception 'Admin cannot read'; end if;
 begin
  perform public.update_order(oid,0,'delivered','','');
  raise exception 'Invalid transition allowed';
 exception when raise_exception then if sqlerrm <> 'Invalid transition' then raise; end if; end;
 perform public.update_order(oid,0,'paid','','');
 begin
  perform public.update_order(oid,0,'cancelled','','');
  raise exception 'Stale write allowed';
 exception when raise_exception then if sqlerrm <> 'Order changed' then raise; end if; end;
 begin
  perform public.update_order(oid,1,'shipped','','');
  raise exception 'Shipping without tracking';
 exception when raise_exception then if sqlerrm <> 'Tracking required' then raise; end if; end;
 perform public.update_order(oid,1,'shipped','Test carrier','TEST123');
 perform public.update_order(oid,2,'delivered','Test carrier','TEST123');
 if (select count(*) from public.order_events where order_id=oid)<>4 then raise exception 'Missing audit events'; end if;
end; $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.create_demo_order('{}');
  raise exception 'Guest can create';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.orders;
  raise exception 'Guest can read';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
