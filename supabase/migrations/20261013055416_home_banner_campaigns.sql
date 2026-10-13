begin;

-- Independent drafts/publications retain the legacy singleton during rollout.
create table public.banner_campaigns (
  like public.banner_drafts including defaults including constraints,
  id uuid primary key default gen_random_uuid(),
  layout text not null default 'split' check (layout in ('split','image')),
  starts_at timestamptz,
  ends_at timestamptz,
  position integer not null default 0 check (position between 0 and 999999),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create table public.banner_publications (
  like public.banner_campaigns including defaults including constraints,
  primary key(id),
  foreign key(id) references public.banner_campaigns(id) on delete restrict
);
create index banner_campaigns_listing on public.banner_campaigns(position,created_at,id) where deleted_at is null;
create index banner_publications_period on public.banner_publications(starts_at,ends_at);
alter table public.banner_campaigns enable row level security;
alter table public.banner_publications enable row level security;
revoke all on public.banner_campaigns,public.banner_publications from public,anon,authenticated;
grant select on public.banner_campaigns to authenticated;
grant insert(slot,title,subtitle,description,link,desktop_path,mobile_path,layout,starts_at,ends_at,position),
      update(title,subtitle,description,link,desktop_path,mobile_path,layout,starts_at,ends_at,position)
  on public.banner_campaigns to authenticated;
grant select on public.banner_publications to anon,authenticated;
grant all on public.banner_campaigns,public.banner_publications to service_role;
create policy campaign_admin_read on public.banner_campaigns for select to authenticated
  using (deleted_at is null and (select public.is_admin()));
create policy campaign_admin_insert on public.banner_campaigns for insert to authenticated
  with check ((select public.is_admin()));
create policy campaign_admin_update on public.banner_campaigns for update to authenticated
  using (deleted_at is null and (select public.is_admin()))
  with check (deleted_at is null and (select public.is_admin()));
create policy campaign_public_read on public.banner_publications for select to anon
  using (deleted_at is null and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy campaign_admin_publications on public.banner_publications for select to authenticated
  using ((select public.is_admin()) or
    (deleted_at is null and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())));
create trigger campaign_revision before update on public.banner_campaigns
  for each row execute function private.banner_revision();

-- Preserve a saved draft and its independently published version under one ID.
insert into public.banner_campaigns(slot,title,subtitle,description,link,desktop_path,mobile_path,revision,updated_at)
select coalesce(d.slot,l.slot),coalesce(d.title,l.title),coalesce(d.subtitle,l.subtitle),
       coalesce(d.description,l.description),coalesce(d.link,l.link),coalesce(d.desktop_path,l.desktop_path),
       coalesce(d.mobile_path,l.mobile_path),coalesce(d.revision,l.revision),coalesce(d.updated_at,l.updated_at)
from public.banner_drafts d full join public.site_banners l using(slot);
insert into public.banner_publications(id,slot,title,subtitle,description,link,desktop_path,mobile_path,revision,updated_at)
select c.id,l.slot,l.title,l.subtitle,l.description,l.link,l.desktop_path,l.mobile_path,l.revision,l.updated_at
from public.site_banners l join public.banner_campaigns c using(slot);

create function private.change_banner_campaign(input_id uuid,expected_revision integer,operation text)
returns public.banner_campaigns language plpgsql security definer set search_path='' as $$
declare draft public.banner_campaigns;
begin
  if auth.uid() is null or not public.is_admin() then raise insufficient_privilege; end if;
  if operation is null or operation not in ('publish','unpublish','delete') then raise exception 'Invalid operation'; end if;
  select * into draft from public.banner_campaigns where id=input_id for update;
  if not found or draft.deleted_at is not null or expected_revision is null or draft.revision<>expected_revision then
    raise exception 'Campaign changed; reload' using errcode='40001';
  end if;
  if operation='publish' then
    if draft.ends_at is not null and draft.ends_at<=now() then raise exception 'Campaign has ended'; end if;
    if not exists(select 1 from storage.objects where bucket_id='site-banners' and name=draft.desktop_path)
      or not exists(select 1 from storage.objects where bucket_id='site-banners' and name=draft.mobile_path) then
      raise exception 'Upload both images before publishing';
    end if;
  end if;
  update public.banner_campaigns
    set updated_at=now(),deleted_at=case when operation='delete' then now() else null end
    where id=input_id returning * into draft;
  if operation='publish' then
    insert into public.banner_publications select (draft).*
    on conflict(id) do update set
      title=excluded.title,subtitle=excluded.subtitle,description=excluded.description,
      link=excluded.link,desktop_path=excluded.desktop_path,mobile_path=excluded.mobile_path,
      layout=excluded.layout,starts_at=excluded.starts_at,ends_at=excluded.ends_at,
      position=excluded.position,revision=excluded.revision,updated_at=excluded.updated_at;
  else
    delete from public.banner_publications where id=input_id;
  end if;
  return draft;
end $$;
revoke all on function private.change_banner_campaign(uuid,integer,text) from public,anon,authenticated;
grant execute on function private.change_banner_campaign(uuid,integer,text) to authenticated;
create function public.change_banner_campaign(input_id uuid,expected_revision integer,operation text)
returns public.banner_campaigns language sql volatile security invoker set search_path='' as $$
  select private.change_banner_campaign(input_id,expected_revision,operation);
$$;
revoke all on function public.change_banner_campaign(uuid,integer,text) from public,anon;
grant execute on function public.change_banner_campaign(uuid,integer,text) to authenticated;

commit;
