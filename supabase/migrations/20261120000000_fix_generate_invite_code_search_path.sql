-- Fix: Supabase installs pgcrypto in the `extensions` schema, while SECURITY DEFINER
-- RPCs like `create_household` and `regenerate_invite_code` restrict `search_path = public`.
-- Explicitly include `extensions` in `generate_invite_code()`'s search_path so
-- `gen_random_bytes(8)` resolves reliably in both Supabase Cloud and local Postgres.

create extension if not exists pgcrypto;

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
