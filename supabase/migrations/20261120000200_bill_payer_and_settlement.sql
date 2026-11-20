-- Track whether a recurring bill was split equally by all members or covered by a single member,
-- plus per-member payback settlement tracking (kept strictly separate from weekly contributions).

alter table public.recurring_bills
  add column if not exists paid_mode text not null default 'all'
  check (paid_mode in ('all', 'single'));

alter table public.recurring_bills
  add column if not exists paid_by uuid references public.profiles(id) on delete set null;

alter table public.recurring_bills
  add column if not exists settled_by uuid[] not null default '{}';
