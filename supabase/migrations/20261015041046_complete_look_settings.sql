begin;
create table public.complete_look_settings (
  id text primary key default 'home' check (id = 'home'),
  enabled boolean not null default true,
  -- Catalog includes static products as well as persisted products; validate against the merged catalog in the action.
  product_id bigint check (product_id > 0),
  image text not null default '' check (length(image) <= 2000),
  eyebrow text not null default 'Seu look completo' check (length(trim(eyebrow)) between 1 and 60),
  title text not null default 'Juntos no' check (length(trim(title)) between 1 and 80),
  accent text not null default 'seu ritmo.' check (length(trim(accent)) between 1 and 80),
  description text not null default 'Top e short na mesma cor. Duas peças que se completam, com liberdade para combinar do seu jeito.' check (length(trim(description)) between 1 and 300),
  button_label text not null default 'Ver conjunto' check (length(trim(button_label)) between 1 and 40),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.complete_look_settings enable row level security;
grant select on public.complete_look_settings to anon, authenticated;
grant update(enabled,product_id,image,eyebrow,title,accent,description,button_label) on public.complete_look_settings to authenticated;
create policy complete_look_read on public.complete_look_settings for select to anon,authenticated using (true);
create policy complete_look_admin_update on public.complete_look_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create trigger complete_look_revision before update on public.complete_look_settings
  for each row execute function private.banner_revision();
insert into public.complete_look_settings(id) values ('home');
commit;
