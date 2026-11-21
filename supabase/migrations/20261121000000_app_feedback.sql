-- In-app ratings, bug reports, and feature requests (works without Play Store)
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'rating' check (kind in ('rating', 'bug', 'feature')),
  rating int check (rating is null or rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  platform text not null default 'web' check (char_length(platform) <= 32),
  app_version text not null default '1.0.0' check (char_length(app_version) <= 32),
  created_at timestamptz not null default now()
);

create index if not exists idx_app_feedback_user_created
  on public.app_feedback (user_id, created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists "Users can insert own feedback" on public.app_feedback;
create policy "Users can insert own feedback"
  on public.app_feedback
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own feedback" on public.app_feedback;
create policy "Users can read own feedback"
  on public.app_feedback
  for select
  using (auth.uid() = user_id);
