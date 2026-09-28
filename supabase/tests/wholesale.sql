-- Execute as postgres after wholesale migration. Fixtures are rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('f830b3e9-8c74-4a43-88de-ecb31d090101','wholesale-one@example.invalid','{}'),
 ('f830b3e9-8c74-4a43-88de-ecb31d090102','wholesale-two@example.invalid','{}'),
 ('f830b3e9-8c74-4a43-88de-ecb31d090103','wholesale-admin@example.invalid','{}');
insert into private.admin_users(user_id,role) values('f830b3e9-8c74-4a43-88de-ecb31d090103','admin');
insert into private.checkout_products(id,data) values(999999,'{"title":"Trusted item","image":"/products/test.jpg","price_cents":48000,"sizes":["M"],"colors":["Black"]}');
update public.wholesale_settings set minimum_quantity=10 where id=true;
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d090101","role":"authenticated"}',true);
set local role authenticated;
do $$ declare req jsonb:='{"key":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","name":"Test Customer","phone":"11999999999","items":[{"id":999999,"size":"M","color":"Black","qty":6,"title":"Forged","price":1},{"id":999999,"size":"M","color":"Black","qty":4}],"user_id":"f830b3e9-8c74-4a43-88de-ecb31d090102"}'; qid uuid;
begin
 qid:=public.create_wholesale_quote(req);
 perform set_config('test.quote',qid::text,true);
 if public.create_wholesale_quote(req)<>qid then raise exception 'Duplicate quote on retry'; end if;
 if not exists(select 1 from public.wholesale_quotes where id=qid and user_id=auth.uid() and cnpj='' and quantity=10 and minimum_quantity=10 and status='received' and items->0->>'title'='Trusted item') then raise exception 'Bad snapshot or owner'; end if;
 if exists(select 1 from public.wholesale_quotes where id=qid and (items->0 ? 'price' or items->0 ? 'price_cents')) then raise exception 'Quote stored retail prices'; end if;
 if (select count(*) from public.wholesale_quote_events where quote_id=qid)<>1 then raise exception 'Duplicate event'; end if;
 begin
  perform public.create_wholesale_quote(req||'{"key":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","items":[{"id":999999,"size":"M","color":"Black","qty":9}]}');
  raise exception 'Minimum bypass';
 exception when raise_exception then if sqlerrm<>'Minimum quantity: 10' then raise; end if; end;
 begin
  perform public.create_wholesale_quote(req||'{"key":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","items":[{"id":999999,"size":"INVALID","color":"Black","qty":10}]}');
  raise exception 'Variant bypass';
 exception when raise_exception then if sqlerrm<>'Invalid variant' then raise; end if; end;
 begin
  perform public.update_wholesale_quote(qid,0,'negotiating','');raise exception 'Customer updated quote';
 exception when insufficient_privilege then null; end;
 update public.wholesale_settings set minimum_quantity=1 where id=true;
 if (select minimum_quantity from public.wholesale_settings)<>10 then raise exception 'Customer changed minimum'; end if;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d090102","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.wholesale_quotes where id=current_setting('test.quote')::uuid) then raise exception 'Cross-account quote leak'; end if;
 if exists(select 1 from public.wholesale_quote_events where quote_id=current_setting('test.quote')::uuid) then raise exception 'Cross-account event leak'; end if;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d090103","role":"authenticated"}',true);
set local role authenticated;
do $$ declare qid uuid:=current_setting('test.quote')::uuid; begin
 update public.wholesale_settings set minimum_quantity=20,whatsapp_number='5511999999999' where id=true;
 if (select minimum_quantity from public.wholesale_settings)<>20 then raise exception 'Admin cannot configure'; end if;
 if (select minimum_quantity from public.wholesale_quotes where id=qid)<>10 then raise exception 'Settings changed prior quote'; end if;
 perform public.update_wholesale_quote(qid,0,'negotiating','Em análise.');
 begin
  perform public.update_wholesale_quote(qid,0,'approved','');raise exception 'Stale write allowed';
 exception when raise_exception then if sqlerrm<>'Quote changed' then raise; end if; end;
 perform public.update_wholesale_quote(qid,1,'approved','Combinado pelo WhatsApp.');
 begin
  perform public.update_wholesale_quote(qid,2,'negotiating','');raise exception 'Closed quote reopened';
 exception when raise_exception then if sqlerrm<>'Invalid transition' then raise; end if; end;
end; $$;
reset role;
set local role anon;
do $$ begin
 if (select minimum_quantity from public.wholesale_settings)<>20 then raise exception 'Public cannot read minimum'; end if;
 begin perform * from public.wholesale_quotes;raise exception 'Guest read quotes';exception when insufficient_privilege then null;end;
 begin perform public.create_wholesale_quote('{}');raise exception 'Guest created quote';exception when insufficient_privilege then null;end;
end; $$;
reset role;
rollback;
