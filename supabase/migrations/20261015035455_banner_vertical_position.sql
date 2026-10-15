begin;
alter table public.banner_campaigns add column desktop_position_y integer not null default 0 check (desktop_position_y between 0 and 100);
alter table public.banner_publications add column desktop_position_y integer not null default 0 check (desktop_position_y between 0 and 100);
grant insert (desktop_position_y), update (desktop_position_y) on public.banner_campaigns to authenticated;

create or replace function private.change_banner_campaign(input_id uuid,expected_revision integer,operation text)
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
      desktop_position_y=excluded.desktop_position_y,position=excluded.position,revision=excluded.revision,updated_at=excluded.updated_at;
  else
    delete from public.banner_publications where id=input_id;
  end if;
  return draft;
end $$;

commit;
