-- Run as postgres after all migrations. Test rows are discarded by ROLLBACK.
begin;
insert into auth.users (id, email, raw_user_meta_data) values
 ('f830b3e9-8c74-4a43-88de-ecb31d095001','account-one@example.invalid','{"role":"super_admin"}'),
 ('f830b3e9-8c74-4a43-88de-ecb31d095002','account-two@example.invalid','{}');
insert into public.addresses (user_id,label,recipient,postal_code,street,number,district,city,state) values
 ('f830b3e9-8c74-4a43-88de-ecb31d095001','Casa','Cliente Um','01001000','Rua A','1','Centro','São Paulo','SP'),
 ('f830b3e9-8c74-4a43-88de-ecb31d095002','Casa','Cliente Dois','01001000','Rua B','2','Centro','São Paulo','SP');
insert into public.orders (user_id,number,status,total_cents) values
 ('f830b3e9-8c74-4a43-88de-ecb31d095001','RLS-ACCOUNT-ONE','paid',10000),
 ('f830b3e9-8c74-4a43-88de-ecb31d095002','RLS-ACCOUNT-TWO','pending',20000);
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d095001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare changed integer;
begin
 if public.is_super_admin() then raise exception 'User metadata granted super admin'; end if;
 if (select count(*) from public.addresses) <> 1 then raise exception 'Address isolation failed'; end if;
 if (select count(*) from public.orders) <> 1 then raise exception 'Order isolation failed'; end if;
 update public.profiles set birth_date = '1990-01-01', phone = '11999999999' where id = auth.uid();
 get diagnostics changed = row_count;
 if changed <> 1 then raise exception 'Cannot update own personal data'; end if;
 update public.addresses set label = 'Forbidden' where user_id <> auth.uid();
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Can update another customer address'; end if;
 delete from public.addresses where user_id <> auth.uid();
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Can delete another customer address'; end if;
 insert into public.addresses (user_id,label,recipient,postal_code,street,number,district,city,state)
 values (auth.uid(),'Trabalho','Cliente Um','01001000','Rua C','3','Centro','São Paulo','SP');
 if (select count(*) from public.addresses) <> 2 then raise exception 'Multiple addresses failed'; end if;
 begin
  insert into public.addresses (user_id,label,recipient,postal_code,street,number,district,city,state)
  values ('f830b3e9-8c74-4a43-88de-ecb31d095002','Forbidden','Cliente','01001000','Rua','1','Centro','São Paulo','SP');
  raise exception 'Can insert another customer address';
 exception when insufficient_privilege then null; end;
 begin
  update public.addresses set user_id = 'f830b3e9-8c74-4a43-88de-ecb31d095002';
  raise exception 'Can transfer address ownership';
 exception when insufficient_privilege then null; end;
 begin
  update public.orders set status = 'paid';
  raise exception 'Customer can change payment status';
 exception when insufficient_privilege then null; end;
 begin
  insert into private.admin_users (user_id,role) values (auth.uid(),'super_admin');
  raise exception 'Customer can become super admin';
 exception when insufficient_privilege then null; end;
end;
$$;
reset role;
insert into private.admin_users (user_id,role) values ('f830b3e9-8c74-4a43-88de-ecb31d095001','admin');
set local role authenticated;
do $$ begin
 if not public.is_admin() or public.is_super_admin() then raise exception 'Admin and super admin are not distinct'; end if;
end; $$;
reset role;
update private.admin_users set role = 'super_admin' where user_id = 'f830b3e9-8c74-4a43-88de-ecb31d095001';
set local role authenticated;
do $$ begin
 if not public.is_admin() or not public.is_super_admin() then raise exception 'Super admin permission missing'; end if;
end; $$;
reset role;
rollback;
