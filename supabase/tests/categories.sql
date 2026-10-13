-- Run as postgres after the category migration. All changes are rolled back.
begin;
insert into auth.users(id,email) values
 ('a9299f36-a2ed-4e43-9aab-ecb31d098001','category-admin@example.invalid'),
 ('a9299f36-a2ed-4e43-9aab-ecb31d098002','category-customer@example.invalid');
insert into private.admin_users(user_id) values ('a9299f36-a2ed-4e43-9aab-ecb31d098001');

set local role anon;
do $$ begin
 perform * from public.product_categories;
 begin
  insert into public.product_categories(kind,label,value) values('piece','Forbidden','Forbidden');
  raise exception 'Visitor can insert';
 exception when insufficient_privilege then null; end;
 begin
  update public.product_categories set archived=true;
  raise exception 'Visitor can update';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.product_categories;
  raise exception 'Visitor can delete';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a9299f36-a2ed-4e43-9aab-ecb31d098002"}',true);
set local role authenticated;
do $$ begin
 begin
  insert into public.product_categories(kind,label,value) values('piece','Forbidden','Forbidden');
  raise exception 'Customer can insert';
 exception when insufficient_privilege then null; end;
 update public.product_categories set archived=true;
 if found then raise exception 'Customer can update'; end if;
 begin
  delete from public.product_categories;
  raise exception 'Customer can delete';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a9299f36-a2ed-4e43-9aab-ecb31d098001"}',true);
set local role authenticated;
insert into public.product_categories(kind,label,value,position) values ('piece','QA Shorts','QA Shorts',12);
do $$ begin
 begin
  insert into public.product_categories(kind,label,value) values ('piece','qa shorts','another-value');
  raise exception 'Duplicate name accepted';
 exception when unique_violation then null; end;
 begin
  insert into public.product_categories(kind,label,value) values ('piece',' ','invalid');
  raise exception 'Blank name accepted';
 exception when check_violation then null; end;
 begin
  update public.product_categories set position=-1 where value='QA Shorts';
  raise exception 'Invalid order accepted';
 exception when check_violation then null; end;
 begin
  update public.product_categories set value='changed' where value='QA Shorts';
  raise exception 'Identity can change';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.product_categories where value='QA Shorts';
  raise exception 'Admin can delete permanent references';
 exception when insufficient_privilege then null; end;
end; $$;
update public.product_categories set label='QA Renamed',archived=true where value='QA Shorts' and revision=1;
do $$ begin
 if not exists(select 1 from public.product_categories where value='QA Shorts' and label='QA Renamed' and archived and revision=2) then
  raise exception 'Rename/archive failed';
 end if;
 update public.product_categories set label='Stale' where value='QA Shorts' and revision=1;
 if found then raise exception 'Stale revision changed category'; end if;
end; $$;
reset role;
set local role anon;
do $$ begin
 if exists(select 1 from public.product_categories where value='QA Shorts') then raise exception 'Archived category is public'; end if;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a9299f36-a2ed-4e43-9aab-ecb31d098002"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.product_categories where value='QA Shorts') then raise exception 'Customer sees archived category'; end if;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a9299f36-a2ed-4e43-9aab-ecb31d098001"}',true);
set local role authenticated;
update public.product_categories set archived=false where value='QA Shorts' and revision=2;
reset role;
set local role anon;
do $$ begin
 if not exists(select 1 from public.product_categories where value='QA Shorts' and label='QA Renamed') then raise exception 'Restored category not visible'; end if;
end; $$;
reset role;
rollback;
