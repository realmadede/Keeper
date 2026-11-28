-- Statement verification receipts for tamper-proof Keeper PDF ledger exports.
-- Strictly isolated per household via Row-Level Security (RLS): non-members cannot read or verify records.

create table if not exists public.statement_verifications (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  household_id uuid not null references public.households(id) on delete cascade,
  generated_by uuid not null references public.profiles(id) on delete cascade,
  generated_by_name text not null,
  filter_label text not null default 'All entries',
  entry_count integer not null check (entry_count >= 0),
  total_contributed bigint not null check (total_contributed >= 0),
  total_spent bigint not null check (total_spent >= 0),
  net_balance bigint not null,
  content_hash text not null,
  transaction_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_statement_verifications_household
  on public.statement_verifications (household_id, created_at desc);

create index if not exists idx_statement_verifications_code
  on public.statement_verifications (code);

alter table public.statement_verifications enable row level security;

drop policy if exists "statement_verifications_select_members" on public.statement_verifications;
create policy "statement_verifications_select_members"
  on public.statement_verifications
  for select
  using (
    exists (
      select 1
      from public.household_members hm
      where hm.household_id = statement_verifications.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "statement_verifications_insert_members" on public.statement_verifications;
create policy "statement_verifications_insert_members"
  on public.statement_verifications
  for insert
  with check (
    generated_by = auth.uid()
    and exists (
      select 1
      from public.household_members hm
      where hm.household_id = statement_verifications.household_id
        and hm.user_id = auth.uid()
    )
  );
