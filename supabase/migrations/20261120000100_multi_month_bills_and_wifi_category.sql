-- Add multi-month billing interval (`interval_months`, e.g. 4 months straight) to `recurring_bills`
-- and split `Security` (`security_internet`) and `Wi-Fi & Internet` (`wifi_internet`) categories.

alter table public.recurring_bills
  add column if not exists interval_months int not null default 1
  check (interval_months between 1 and 60);

-- Widen category CHECK constraints on transactions, household_needs, and recurring_bills
-- so both `security_internet` (Security) and `wifi_internet` (Wi-Fi & Internet) are allowed.
alter table public.transactions
  drop constraint if exists transactions_category_check;

alter table public.transactions
  add constraint transactions_category_check check (
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
  );

alter table public.household_needs
  drop constraint if exists household_needs_category_check;

alter table public.household_needs
  add constraint household_needs_category_check check (
    category in (
      'food',
      'electricity_water',
      'rent',
      'security_internet',
      'wifi_internet',
      'supplies',
      'transport'
    )
  );

alter table public.recurring_bills
  drop constraint if exists recurring_bills_category_check;

alter table public.recurring_bills
  add constraint recurring_bills_category_check check (
    category in (
      'food',
      'electricity_water',
      'rent',
      'security_internet',
      'wifi_internet',
      'supplies',
      'transport'
    )
  );
