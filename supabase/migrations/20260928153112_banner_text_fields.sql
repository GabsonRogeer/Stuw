begin;
-- Existing banners retain their content; new optional fields start empty.
alter table public.banner_drafts
 add column subtitle text not null default '' check (char_length(subtitle) <= 160),
 add column description text not null default '' check (char_length(description) <= 300);
alter table public.site_banners
 add column subtitle text not null default '' check (char_length(subtitle) <= 160),
 add column description text not null default '' check (char_length(description) <= 300);
grant insert (subtitle,description), update (subtitle,description)
 on public.banner_drafts to authenticated;

create or replace function private.publish_home_banner(expected_revision integer)
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
 insert into public.site_banners(slot,title,subtitle,description,link,desktop_path,mobile_path,revision,updated_at)
 values ('home',draft.title,draft.subtitle,draft.description,draft.link,draft.desktop_path,draft.mobile_path,draft.revision,clock_timestamp())
 on conflict (slot) do update set title=excluded.title,subtitle=excluded.subtitle,
 description=excluded.description,link=excluded.link,
 desktop_path=excluded.desktop_path,mobile_path=excluded.mobile_path,
 revision=excluded.revision,updated_at=excluded.updated_at;
end;
$$;
revoke all on function private.publish_home_banner(integer) from public, anon, authenticated;
grant execute on function private.publish_home_banner(integer) to authenticated;
commit;
