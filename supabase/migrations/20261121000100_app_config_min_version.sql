-- Remote minimum app version gate so the developer can prompt older APKs to update
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  min_app_version text not null default '1.0.0',
  update_message text not null default 'A newer version of Keeper is required. Please download the latest update to continue.',
  download_url text not null default 'https://github.com/realmadede/Keeper/releases/latest/download/Keeper.apk',
  updated_at timestamptz not null default now()
);

insert into public.app_config (id, min_app_version)
values (1, '1.0.0')
on conflict (id) do nothing;

alter table public.app_config enable row level security;

drop policy if exists "Anyone can read app config" on public.app_config;
create policy "Anyone can read app config"
  on public.app_config
  for select
  using (true);
