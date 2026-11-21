-- Historical log of every recurring bill payment so households keep year-long payment history
create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  bill_id uuid not null references public.recurring_bills(id) on delete cascade,
  bill_title text not null check (char_length(trim(bill_title)) between 1 and 80),
  amount bigint not null check (amount > 0 and amount <= 10000000000),
  pool_amount_used bigint not null default 0 check (pool_amount_used >= 0 and pool_amount_used <= 10000000000),
  paid_date date not null default current_date,
  paid_mode text not null default 'all' check (paid_mode in ('all', 'single')),
  paid_by uuid references public.profiles(id) on delete set null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_bill_payments_household_date
  on public.bill_payments (household_id, paid_date desc, created_at desc);

alter table public.bill_payments enable row level security;

drop policy if exists "Members can view household bill payments" on public.bill_payments;
create policy "Members can view household bill payments"
  on public.bill_payments
  for select
  using (public.is_household_member(household_id));

drop policy if exists "Members can insert household bill payments" on public.bill_payments;
create policy "Members can insert household bill payments"
  on public.bill_payments
  for insert
  with check (public.is_household_member(household_id) and auth.uid() = recorded_by);

drop policy if exists "Members can delete household bill payments" on public.bill_payments;
create policy "Members can delete household bill payments"
  on public.bill_payments
  for delete
  using (public.is_household_member(household_id));
