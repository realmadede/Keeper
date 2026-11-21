-- Keeper — Final Hardened Supabase PostgreSQL Schema, RLS Policies, Triggers & Realtime
-- Safe to run once on a fresh Supabase project (and idempotent on upgrades) in SQL Editor.

create extension if not exists pgcrypto;

-- Helper: cryptographically random 8-character unambiguous invite code (32^8 ~ 1.1T combinations)
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw_bytes bytea := gen_random_bytes(8);
  result text := '';
  i int;
begin
  for i in 0..7 loop
    result := result || substr(alphabet, (get_byte(raw_bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

-- 1. Profiles (automatically created on user signup)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 80),
  email text not null,
  avatar_color text not null default '#BFA377' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists accepted_terms_at timestamptz;

-- 2. Households (one household, one shared weekly budget in TZS)
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  currency text not null default 'TZS' check (currency = 'TZS'),
  weekly_budget_target bigint not null default 200000 check (weekly_budget_target between 0 and 10000000000),
  member_weekly_share bigint not null default 50000 check (member_weekly_share between 0 and 10000000000),
  invite_code text not null unique default public.generate_invite_code(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.households
  alter column invite_code set default public.generate_invite_code();

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
  recorded_by uuid references public.profiles(id) on delete set null,
  paid_by uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('contribution', 'expense')),
  amount bigint not null check (amount > 0 and amount <= 10000000000),
  category text not null check (
    category in (
      'contribution',
      'food',
      'electricity_water',
      'rent',
      'security_internet',
      'wifi_internet',
      'supplies',
      'transport'
    )
  ),
  description text not null check (char_length(trim(description)) between 1 and 200),
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- Safe additive columns if upgrading an existing database
alter table public.transactions
  add column if not exists paid_by uuid references public.profiles(id) on delete set null;
alter table public.transactions
  add column if not exists updated_at timestamptz;

create index if not exists idx_transactions_household_date
  on public.transactions (household_id, transaction_date desc, created_at desc);

create index if not exists idx_transactions_recorder_created
  on public.transactions (recorded_by, created_at desc);

-- 5. Internal rate-limit log for failed invite-code guesses (no direct client access)
create table if not exists public.invite_join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_invite_attempts_user_time
  on public.invite_join_attempts (user_id, attempted_at desc);

-- 6. Shared Household Restock / Needs List
create table if not exists public.household_needs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  quantity text check (quantity is null or char_length(trim(quantity)) <= 40),
  estimated_amount bigint check (estimated_amount is null or (estimated_amount > 0 and estimated_amount <= 10000000000)),
  actual_amount bigint check (actual_amount is null or (actual_amount > 0 and actual_amount <= 10000000000)),
  paid_mode text not null default 'all' check (paid_mode in ('all', 'single')),
  paid_by uuid references public.profiles(id) on delete set null,
  settled_by uuid[] not null default '{}',
  pool_amount_used bigint not null default 0 check (pool_amount_used >= 0 and pool_amount_used <= 10000000000),
  category text not null default 'food' check (
    category in ('food', 'electricity_water', 'rent', 'security_internet', 'wifi_internet', 'supplies', 'transport')
  ),
  is_bought boolean not null default false,
  bought_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.household_needs
  add column if not exists quantity text check (quantity is null or char_length(trim(quantity)) <= 40);
alter table public.household_needs
  add column if not exists estimated_amount bigint check (estimated_amount is null or (estimated_amount > 0 and estimated_amount <= 10000000000));
alter table public.household_needs
  add column if not exists actual_amount bigint check (actual_amount is null or (actual_amount > 0 and actual_amount <= 10000000000));
alter table public.household_needs
  add column if not exists paid_mode text not null default 'all' check (paid_mode in ('all', 'single'));
alter table public.household_needs
  add column if not exists paid_by uuid references public.profiles(id) on delete set null;
alter table public.household_needs
  add column if not exists settled_by uuid[] not null default '{}';
alter table public.household_needs
  add column if not exists pool_amount_used bigint not null default 0 check (pool_amount_used >= 0 and pool_amount_used <= 10000000000);

create index if not exists idx_household_needs_household
  on public.household_needs (household_id, is_bought, created_at desc);

-- 7. Recurring Monthly Household Bills & Due-Date Reminders
create table if not exists public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 80),
  amount bigint not null check (amount > 0 and amount <= 10000000000),
  category text not null check (
    category in ('food', 'electricity_water', 'rent', 'security_internet', 'wifi_internet', 'supplies', 'transport')
  ),
  due_day int not null check (due_day between 1 and 31),
  interval_months int not null default 1 check (interval_months between 1 and 60),
  last_paid_month text check (last_paid_month is null or last_paid_month ~ '^[0-9]{4}-[0-9]{2}$'),
  paid_mode text not null default 'all' check (paid_mode in ('all', 'single')),
  paid_by uuid references public.profiles(id) on delete set null,
  settled_by uuid[] not null default '{}',
  pool_amount_used bigint not null default 0 check (pool_amount_used >= 0 and pool_amount_used <= 10000000000),
  created_at timestamptz not null default now()
);

alter table public.recurring_bills
  add column if not exists interval_months int not null default 1 check (interval_months between 1 and 60);
alter table public.recurring_bills
  add column if not exists paid_mode text not null default 'all' check (paid_mode in ('all', 'single'));
alter table public.recurring_bills
  add column if not exists paid_by uuid references public.profiles(id) on delete set null;
alter table public.recurring_bills
  add column if not exists settled_by uuid[] not null default '{}';
alter table public.recurring_bills
  add column if not exists pool_amount_used bigint not null default 0 check (pool_amount_used >= 0 and pool_amount_used <= 10000000000);

create index if not exists idx_recurring_bills_household
  on public.recurring_bills (household_id, due_day asc);

-- 8. In-App Ratings, Bug Reports & Feature Requests
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
  safe_name text := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    80
  );
  terms_ts timestamptz := case
    when coalesce((new.raw_user_meta_data->>'accepted_terms')::boolean, false)
      or coalesce(new.raw_app_meta_data->>'provider', '') = 'google'
    then now()
    else null
  end;
begin
  insert into public.profiles (id, full_name, email, avatar_color, accepted_terms_at)
  values (new.id, safe_name, new.email, chosen_color, terms_ts)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Integrity triggers: lock protected/audit columns and enforce DB write rate limit
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;
  new.accepted_terms_at := old.accepted_terms_at;
  new.full_name := left(trim(new.full_name), 80);
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_update on public.profiles;
create trigger trg_guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.guard_household_update()
returns trigger
language plpgsql
as $$
begin
  new.id := old.id;
  new.created_by := old.created_by;
  new.currency := old.currency;
  new.created_at := old.created_at;
  if coalesce(current_setting('keeper.allow_invite_rotation', true), '') <> 'true' then
    new.invite_code := old.invite_code;
  end if;
  if coalesce(current_setting('keeper.allow_household_rename', true), '') <> 'true' then
    new.name := old.name;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_household_update on public.households;
create trigger trg_guard_household_update
  before update on public.households
  for each row execute function public.guard_household_update();

create or replace function public.guard_transaction_insert()
returns trigger
language plpgsql
as $$
declare
  recent_count int;
begin
  -- DB-side write rate limit: max 30 transactions per user in 10 minutes
  select count(*) into recent_count
  from public.transactions
  where recorded_by = new.recorded_by
    and created_at > now() - interval '10 minutes';

  if recent_count >= 30 then
    raise exception 'Rate limit exceeded. Please wait a few minutes before recording more entries.';
  end if;

  new.description := left(trim(new.description), 200);
  new.created_at := now();
  new.updated_at := null;
  if new.type = 'expense' then
    new.paid_by := new.recorded_by;
  elsif new.paid_by is null then
    new.paid_by := new.recorded_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_transaction_insert on public.transactions;
create trigger trg_guard_transaction_insert
  before insert on public.transactions
  for each row execute function public.guard_transaction_insert();

create or replace function public.guard_transaction_update()
returns trigger
language plpgsql
as $$
begin
  -- Server-side immutable audit fields: edits can never hide updated_at or change ownership
  new.id := old.id;
  new.household_id := old.household_id;
  new.recorded_by := old.recorded_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.description := left(trim(new.description), 200);
  if new.type = 'expense' then
    new.paid_by := old.recorded_by;
  elsif new.paid_by is null then
    new.paid_by := old.recorded_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_transaction_update on public.transactions;
create trigger trg_guard_transaction_update
  before update on public.transactions
  for each row execute function public.guard_transaction_update();

-- Membership helpers (avoid recursive RLS lookups)
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

create or replace function public.is_user_in_household(target_household_id uuid, target_user_id uuid)
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
      and user_id = target_user_id
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
  clean_name text := left(trim(coalesce(household_name, '')), 80);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(clean_name) < 1 then
    raise exception 'Household name is required';
  end if;

  insert into public.households (name, currency, weekly_budget_target, member_weekly_share, created_by)
  values (
    clean_name,
    'TZS',
    least(10000000000, greatest(0, budget_target)),
    least(10000000000, greatest(0, member_share)),
    auth.uid()
  )
  returning * into created;

  insert into public.household_members (household_id, user_id, role)
  values (created.id, auth.uid(), 'admin');

  return created;
end;
$$;

-- Atomic RPC: Join a private household by invite code (with 5-tries / 15-min rate limiting)
create or replace function public.join_household_by_code(code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  found_household public.households;
  clean_code text := upper(trim(coalesce(code, '')));
  failed_attempts int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.invite_join_attempts
  where user_id = auth.uid()
    and attempted_at < now() - interval '15 minutes';

  select count(*) into failed_attempts
  from public.invite_join_attempts
  where user_id = auth.uid()
    and attempted_at >= now() - interval '15 minutes';

  if failed_attempts >= 5 then
    raise exception 'Too many invalid invite code attempts. Please wait 15 minutes and try again.';
  end if;

  if clean_code !~ '^[A-Z0-9]{6,12}$' then
    insert into public.invite_join_attempts (user_id) values (auth.uid());
    raise exception 'Invalid household invite code';
  end if;

  select * into found_household
  from public.households
  where upper(invite_code) = clean_code
  limit 1;

  if found_household.id is null then
    insert into public.invite_join_attempts (user_id) values (auth.uid());
    raise exception 'Invalid household invite code';
  end if;

  delete from public.invite_join_attempts where user_id = auth.uid();

  insert into public.household_members (household_id, user_id, role)
  values (found_household.id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  return found_household;
end;
$$;

-- Admin-only RPC: Rotate household invite code to revoke leaked codes
create or replace function public.regenerate_invite_code(target_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  next_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'Only household admins can rotate the invite code';
  end if;

  next_code := public.generate_invite_code();
  perform set_config('keeper.allow_invite_rotation', 'true', true);

  update public.households
  set invite_code = next_code
  where id = target_household_id;

  return next_code;
end;
$$;

-- Admin-only RPC: Rename household
create or replace function public.rename_household(target_household_id uuid, new_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  clean_name text := left(trim(coalesce(new_name, '')), 80);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(clean_name) < 1 then
    raise exception 'Household name cannot be empty';
  end if;

  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'Only household admins can rename the household';
  end if;

  perform set_config('keeper.allow_household_rename', 'true', true);

  update public.households
  set name = clean_name
  where id = target_household_id;

  return clean_name;
end;
$$;

-- Admin-only RPC: Promote a roommate to admin
create or replace function public.promote_household_member(target_household_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'Only household admins can promote members';
  end if;

  update public.household_members
  set role = 'admin'
  where household_id = target_household_id
    and user_id = target_user_id;
end;
$$;

-- Admin-only RPC: Remove a former roommate from the household
create or replace function public.remove_household_member(target_household_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Use Leave Household to remove yourself';
  end if;

  select exists (
    select 1
    from public.household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'Only household admins can remove members';
  end if;

  delete from public.household_members
  where household_id = target_household_id
    and user_id = target_user_id;
end;
$$;

-- Self-service RPC: Permanently delete own account without stranding shared households
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec record;
  other_admin_count int;
  next_member_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure no household with remaining roommates is left without an admin
  for rec in
    select household_id, role
    from public.household_members
    where user_id = uid
  loop
    select count(*) into other_admin_count
    from public.household_members
    where household_id = rec.household_id
      and user_id <> uid
      and role = 'admin';

    if other_admin_count = 0 then
      select user_id into next_member_id
      from public.household_members
      where household_id = rec.household_id
        and user_id <> uid
      order by joined_at asc
      limit 1;

      if next_member_id is not null then
        update public.household_members
        set role = 'admin'
        where household_id = rec.household_id
          and user_id = next_member_id;
      else
        -- Last member in household: remove empty household cleanly
        delete from public.households where id = rec.household_id;
      end if;
    end if;
  end loop;

  delete from auth.users where id = uid;
end;
$$;

-- Least-privilege EXECUTE grants (block unauthenticated anon role from calling RPCs)
revoke all on function public.generate_invite_code() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_user_in_household(uuid, uuid) from public, anon;
revoke all on function public.create_household(text, bigint, bigint) from public, anon;
revoke all on function public.join_household_by_code(text) from public, anon;
revoke all on function public.regenerate_invite_code(uuid) from public, anon;
revoke all on function public.rename_household(uuid, text) from public, anon;
revoke all on function public.promote_household_member(uuid, uuid) from public, anon;
revoke all on function public.remove_household_member(uuid, uuid) from public, anon;
revoke all on function public.delete_own_account() from public, anon;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_user_in_household(uuid, uuid) to authenticated;
grant execute on function public.create_household(text, bigint, bigint) to authenticated;
grant execute on function public.join_household_by_code(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.rename_household(uuid, text) to authenticated;
grant execute on function public.promote_household_member(uuid, uuid) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.delete_own_account() to authenticated;

-- Row-Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.transactions enable row level security;
alter table public.invite_join_attempts enable row level security;
alter table public.household_needs enable row level security;
alter table public.recurring_bills enable row level security;

-- Profiles: users can see their own profile and profiles of household roommates
drop policy if exists "Read own and roommate profiles" on public.profiles;
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

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Households: members can read and update their shared household budget (protected columns locked by trigger)
drop policy if exists "Members can view household" on public.households;
create policy "Members can view household"
  on public.households for select
  using (public.is_household_member(id));

drop policy if exists "Members can update household budget" on public.households;
create policy "Members can update household budget"
  on public.households for update
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- Household members: members can view all roommates and leave
drop policy if exists "Members can view household members" on public.household_members;
create policy "Members can view household members"
  on public.household_members for select
  using (public.is_household_member(household_id));

drop policy if exists "Members can leave household" on public.household_members;
create policy "Members can leave household"
  on public.household_members for delete
  using (user_id = auth.uid());

-- Transactions: full transparency inside the household, paid_by restricted to household members
drop policy if exists "Members can view household transactions" on public.transactions;
create policy "Members can view household transactions"
  on public.transactions for select
  using (public.is_household_member(household_id));

drop policy if exists "Members can record household transactions" on public.transactions;
create policy "Members can record household transactions"
  on public.transactions for insert
  with check (
    public.is_household_member(household_id)
    and recorded_by = auth.uid()
    and (paid_by is null or public.is_user_in_household(household_id, paid_by))
  );

drop policy if exists "Recorder can update own transaction" on public.transactions;
create policy "Recorder can update own transaction"
  on public.transactions for update
  using (
    public.is_household_member(household_id)
    and recorded_by = auth.uid()
  )
  with check (
    public.is_household_member(household_id)
    and recorded_by = auth.uid()
    and (paid_by is null or public.is_user_in_household(household_id, paid_by))
  );

drop policy if exists "Recorder can delete own transaction" on public.transactions;
create policy "Recorder can delete own transaction"
  on public.transactions for delete
  using (
    public.is_household_member(household_id)
    and recorded_by = auth.uid()
  );

-- Household Needs: all members of a household share the restock checklist
drop policy if exists "Members can view household needs" on public.household_needs;
create policy "Members can view household needs"
  on public.household_needs for select
  using (public.is_household_member(household_id));

drop policy if exists "Members can add household needs" on public.household_needs;
create policy "Members can add household needs"
  on public.household_needs for insert
  with check (
    public.is_household_member(household_id)
    and added_by = auth.uid()
  );

drop policy if exists "Members can update household needs" on public.household_needs;
create policy "Members can update household needs"
  on public.household_needs for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "Members can delete household needs" on public.household_needs;
create policy "Members can delete household needs"
  on public.household_needs for delete
  using (public.is_household_member(household_id));

-- Recurring Bills: all members can track and mark shared monthly bills paid
drop policy if exists "Members can view recurring bills" on public.recurring_bills;
create policy "Members can view recurring bills"
  on public.recurring_bills for select
  using (public.is_household_member(household_id));

drop policy if exists "Members can add recurring bills" on public.recurring_bills;
create policy "Members can add recurring bills"
  on public.recurring_bills for insert
  with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
  );

drop policy if exists "Members can update recurring bills" on public.recurring_bills;
create policy "Members can update recurring bills"
  on public.recurring_bills for update
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "Members can delete recurring bills" on public.recurring_bills;
create policy "Members can delete recurring bills"
  on public.recurring_bills for delete
  using (public.is_household_member(household_id));

-- Enable Supabase Realtime safely (idempotent)
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.households;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.household_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.household_needs;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.recurring_bills;
exception when duplicate_object then null;
end $$;
