-- Run as postgres. Test image metadata is transactional; no real files are uploaded.
begin;
insert into auth.users(id,email) values
 ('f830b3e9-8c74-4a43-88de-ecb31d098001','banner-admin@example.invalid'),
 ('f830b3e9-8c74-4a43-88de-ecb31d098002','banner-client@example.invalid');
insert into private.admin_users(user_id) values ('f830b3e9-8c74-4a43-88de-ecb31d098001');
-- These transactional changes are rolled back, restoring any existing banner.
delete from public.site_banners where slot='home';
delete from public.banner_drafts where slot='home';
set local role anon;
do $$ begin
 begin
  perform * from public.banner_drafts;
  raise exception 'Visitor can read drafts';
 exception when insufficient_privilege then null; end;
 begin
  perform public.publish_home_banner(1);
  raise exception 'Visitor can publish';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d098002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 begin
  insert into storage.objects(bucket_id,name) values ('site-banners','home/cccccccc-cccc-cccc-cccc-cccccccccccc.jpg');
  raise exception 'Customer can upload';
 exception when insufficient_privilege then null; end;
 begin
  perform public.publish_home_banner(1);
  raise exception 'Customer can publish';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claims','{"sub":"f830b3e9-8c74-4a43-88de-ecb31d098001","role":"authenticated"}',true);
set local role authenticated;
insert into storage.objects(bucket_id,name) values
 ('site-banners','home/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg'),
 ('site-banners','home/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.webp');
insert into public.banner_drafts(slot,title,link,desktop_path,mobile_path) values
 ('home','Banner original','/produtos','home/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg','home/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.webp');
do $$ begin
 if exists(select 1 from public.site_banners) then raise exception 'Draft became public before publishing'; end if;
end; $$;
select public.publish_home_banner(1);
update public.banner_drafts set title='Novo rascunho', subtitle='O luxo da pausa.', description='Descrição do banner.' where slot='home';
do $$ begin
 if (select title from public.site_banners where slot='home') <> 'Banner original' then raise exception 'Draft edit changed live content'; end if;
 if (select subtitle from public.site_banners where slot='home') <> '' then raise exception 'Draft subtitle leaked into publication'; end if;
 begin
  perform public.publish_home_banner(1);
  raise exception 'Stale draft was published';
 exception when raise_exception then
  if sqlerrm <> 'Draft changed; reload before publishing' then raise; end if;
 end;
end; $$;
select public.publish_home_banner(2);
reset role;
set local role anon;
do $$ begin
 if (select title from public.site_banners where slot='home') <> 'Novo rascunho' then raise exception 'Published banner not visible'; end if;
 if (select subtitle from public.site_banners where slot='home') <> 'O luxo da pausa.' then raise exception 'Subtitle not published'; end if;
 if (select description from public.site_banners where slot='home') <> 'Descrição do banner.' then raise exception 'Description not published'; end if;
end; $$;
reset role;
set local role authenticated;
select public.unpublish_home_banner();
do $$ begin
 if exists(select 1 from public.site_banners) then raise exception 'Unpublish failed'; end if;
 if not exists(select 1 from public.banner_drafts) then raise exception 'Unpublish deleted draft'; end if;
end; $$;
reset role;
rollback;
