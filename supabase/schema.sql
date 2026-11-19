-- Keeper — Supabase PostgreSQL Schema, RLS Policies & Realtime
-- Run this entire script once in your Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

-- 1. Profiles (automatically created on user signup)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_color text not null default '#BFA377',
  created_at timestamptz not null default now()
);

-- 2. Households (one household, one shared weekly budget in TZS)
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'TZS',
  weekly_budget_target bigint not null default 200000 check (weekly_budget_target >= 0),
  member_weekly_share bigint not null default 50000 check (member_weekly_share >= 0),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 3. Household Members
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- 4. Shared Transactions (contributions + household expenses)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('contribution', 'expense')),
  amount bigint not null check (amount > 0),
  category text not null,
  description text not null,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_household_date
  on public.transactions (household_id, transaction_date desc, created_at desc);

-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  colors text[] := array['#BFA377', '#3B82F6', '#10B981', '#F97316', '#8B5CF6', '#EC4899'];
  chosen_color text := colors[1 + floor(random() * array_length(colors, 1))::int];
begin
  insert into public.profiles (id, full_name, email, avatar_color)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    chosen_color
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Membership helper (avoids recursive RLS lookups)
create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

-- Atomic RPC: Create a household and enroll creator as admin
create or replace function public.create_household(
  household_name text,
  budget_target bigint default 200000,
  member_share bigint default 50000
)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.households (name, currency, weekly_budget_target, member_weekly_share, created_by)
  values (trim(household_name), 'TZS', greatest(0, budget_target), greatest(0, member_share), auth.uid())
  returning * into created;

  insert into public.household_members (household_id, user_id, role)
  values (created.id, auth.uid(), 'admin');

  return created;
end;
$$;

-- Atomic RPC: Join a private household by invite code
create or replace function public.join_household_by_code(code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  found_household public.households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into found_household
  from public.households
  where upper(invite_code) = upper(trim(code))
  limit 1;

  if found_household.id is null then
    raise exception 'Invalid household invite code';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (found_household.id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  return found_household;
end;
$$;

-- Row-Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.transactions enable row level security;

-- Profiles: users can see their own profile and profiles of household roommates
create policy "Read own and roommate profiles"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members hm1
      join public.household_members hm2 on hm1.household_id = hm2.household_id
      where hm1.user_id = auth.uid()
        and hm2.user_id = profiles.id
    )
  );

create policy "Update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Households: members can read and update their shared household budget
create policy "Members can view household"
  on public.households for select
  using (public.is_household_member(id));

create policy "Members can update household budget"
  on public.households for update
  using (public.is_household_member(id));

-- Household members: members can view all roommates and leave
create policy "Members can view household members"
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy "Members can leave household"
  on public.household_members for delete
  using (user_id = auth.uid());

-- Transactions: full transparency inside the household
create policy "Members can view household transactions"
  on public.transactions for select
  using (public.is_household_member(household_id));

create policy "Members can record household transactions"
  on public.transactions for insert
  with check (
    public.is_household_member(household_id)
    and recorded_by = auth.uid()
  );

create policy "Recorder can delete own transaction"
  on public.transactions for delete
  using (
    public.is_household_member(household_id)
    and recorded_by = auth.uid()
  );

-- Enable Supabase Realtime for live synchronization across household members
alter publication supabase_realtime add table public.households;
alter publication supabase_realtime add table public.household_members;
alter publication supabase_realtime add table public.transactions;
