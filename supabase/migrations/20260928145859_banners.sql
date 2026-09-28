begin;
create table public.banner_drafts (
 slot text primary key check (slot = 'home'),
 title text not null check (char_length(trim(title)) between 2 and 160),
 link text not null check (
  char_length(link) between 1 and 1000 and
  (link = '/' or link ~ '^/[^/\\[:space:]]' or link ~ '^https://[^[:space:]]+$') and
  link !~ '[[:space:]\\]'
 ),
 desktop_path text not null check (desktop_path ~ '^home/[0-9a-f-]{36}\.(jpg|png|webp)$'),
 mobile_path text not null check (mobile_path ~ '^home/[0-9a-f-]{36}\.(jpg|png|webp)$'),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create table public.site_banners (like public.banner_drafts including all);
alter table public.banner_drafts enable row level security;
alter table public.site_banners enable row level security;
revoke all on public.banner_drafts, public.site_banners from public, anon, authenticated;
grant select on public.banner_drafts to authenticated;
grant insert (slot,title,link,desktop_path,mobile_path) on public.banner_drafts to authenticated;
grant update (title,link,desktop_path,mobile_path) on public.banner_drafts to authenticated;
grant select on public.site_banners to anon, authenticated;
grant all on public.banner_drafts, public.site_banners to service_role;
create policy banner_draft_admin_read on public.banner_drafts for select to authenticated using ((select public.is_admin()));
create policy banner_draft_admin_insert on public.banner_drafts for insert to authenticated with check ((select public.is_admin()));
create policy banner_draft_admin_update on public.banner_drafts for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy banner_live_read on public.site_banners for select to anon, authenticated using (true);

create function private.banner_revision() returns trigger language plpgsql set search_path = ''
as $$ begin new.revision := old.revision + 1; new.updated_at := clock_timestamp(); return new; end; $$;
revoke all on function private.banner_revision() from public, anon, authenticated;
create trigger banner_revision before update on public.banner_drafts for each row execute function private.banner_revision();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('site-banners','site-banners',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy banner_assets_admin_read on storage.objects for select to authenticated
using (bucket_id = 'site-banners' and (select public.is_admin()));
create policy banner_assets_admin_upload on storage.objects for insert to authenticated
with check (bucket_id = 'site-banners' and name ~ '^home/[0-9a-f-]{36}\.(jpg|png|webp)$' and (select public.is_admin()));
-- No update/delete policy: unique immutable assets preserve published versions.

create function private.publish_home_banner(expected_revision integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare draft public.banner_drafts%rowtype;
begin
 if (select auth.uid()) is null or not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
 select * into draft from public.banner_drafts where slot='home' for update;
 if not found or draft.revision <> expected_revision then raise exception 'Draft changed; reload before publishing'; end if;
 if not exists(select 1 from storage.objects where bucket_id='site-banners' and name=draft.desktop_path)
 or not exists(select 1 from storage.objects where bucket_id='site-banners' and name=draft.mobile_path)
 then raise exception 'Upload both images before publishing'; end if;
 insert into public.site_banners(slot,title,link,desktop_path,mobile_path,revision,updated_at)
 values ('home',draft.title,draft.link,draft.desktop_path,draft.mobile_path,draft.revision,clock_timestamp())
 on conflict (slot) do update set title=excluded.title,link=excluded.link,
 desktop_path=excluded.desktop_path,mobile_path=excluded.mobile_path,
 revision=excluded.revision,updated_at=excluded.updated_at;
end;
$$;
revoke all on function private.publish_home_banner(integer) from public, anon, authenticated;
grant execute on function private.publish_home_banner(integer) to authenticated;
grant usage on schema private to authenticated;
create function public.publish_home_banner(expected_revision integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.publish_home_banner(expected_revision); $$;
revoke all on function public.publish_home_banner(integer) from public, anon;
grant execute on function public.publish_home_banner(integer) to authenticated;

create function private.unpublish_home_banner()
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
 delete from public.site_banners where slot='home';
end;
$$;
revoke all on function private.unpublish_home_banner() from public, anon, authenticated;
grant execute on function private.unpublish_home_banner() to authenticated;
create function public.unpublish_home_banner()
returns void language sql volatile security invoker set search_path = ''
as $$ select private.unpublish_home_banner(); $$;
revoke all on function public.unpublish_home_banner() from public, anon;
grant execute on function public.unpublish_home_banner() to authenticated;
commit;
