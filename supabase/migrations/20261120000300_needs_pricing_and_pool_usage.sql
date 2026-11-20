-- Add shopping-list pricing, payer split, payback tracking, and optional leftover pool usage
-- to household_needs and recurring_bills.

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

alter table public.recurring_bills
  add column if not exists pool_amount_used bigint not null default 0 check (pool_amount_used >= 0 and pool_amount_used <= 10000000000);
