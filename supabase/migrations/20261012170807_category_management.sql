begin;

create table public.product_categories (
  id integer generated always as identity primary key,
  kind text not null check (kind in ('piece', 'activity')),
  label text not null check (label = btrim(label) and char_length(label) between 1 and 80),
  -- Stable filter value: changing the display name never breaks products or existing URLs.
  value text not null check (value = btrim(value) and char_length(value) between 1 and 80),
  position integer not null default 0 check (position between 0 and 999999),
  archived boolean not null default false,
  revision integer not null default 1,
  unique (kind, value)
);
create unique index product_categories_label_unique on public.product_categories(kind, lower(label));
create index product_categories_listing on public.product_categories(archived, kind, id);

alter table public.product_categories enable row level security;
revoke all on public.product_categories from public, anon, authenticated;
grant select on public.product_categories to anon, authenticated;
grant insert(kind, label, value, position), update(label, position, archived) on public.product_categories to authenticated;
grant usage on sequence public.product_categories_id_seq to authenticated;
create policy categories_public_read on public.product_categories for select to anon using (not archived);
create policy categories_user_read on public.product_categories for select to authenticated
  using (not archived or (select public.is_admin()));
create policy categories_admin_insert on public.product_categories for insert to authenticated
  with check ((select public.is_admin()));
create policy categories_admin_update on public.product_categories for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create function private.revise_category() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id <> old.id or new.kind <> old.kind or new.value <> old.value then
    raise exception 'Category identity is immutable';
  end if;
  new.revision := old.revision + 1;
  return new;
end;
$$;
revoke all on function private.revise_category() from public, anon, authenticated;
create trigger revise_category before update on public.product_categories
  for each row execute function private.revise_category();

insert into public.product_categories(kind, label, value, position) values
('piece', 'Conjuntos', 'Conjuntos', 0),
('piece', 'Leggings', 'Leggings & Calças', 1),
('piece', 'Tops', 'Tops & Sutiãs', 2),
('piece', 'Macacões', 'Macacões & Bodies', 3),
('piece', 'Jaquetas', 'Alfaiataria Esportiva', 4),
('piece', 'Saias', 'Tennis & Saias', 5),
('piece', 'Acessórios', 'Acessórios & Wellness', 6),
('activity', 'Training', 'Activewear / Training', 0),
('activity', 'Running', 'Activewear / Running', 1),
('activity', 'Studio', 'Activewear / Studio', 2),
('activity', 'Lifestyle', 'Activewear / Lifestyle', 3),
('activity', 'Tennis', 'Activewear / Tennis', 4),
('activity', 'Recovery', 'Wellness / Recovery', 5);

-- Enforce taxonomy membership even when save_product is called directly.
-- Archived categories remain valid references; the admin UI prevents new assignments.
create function private.check_product_categories() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare field text; category_kind text;
begin
  foreach field in array array['category', 'activityCategory'] loop
    category_kind := case when field = 'category' then 'piece' else 'activity' end;
    if coalesce(new.document->>field, '') <> '' and not exists (
      select 1 from public.product_categories where kind = category_kind and value = new.document->>field
    ) then
      raise exception 'Invalid category' using errcode = '23503';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.check_product_categories() from public, anon, authenticated;
create trigger check_product_categories before insert or update of document on public.admin_products
  for each row execute function private.check_product_categories();

commit;
