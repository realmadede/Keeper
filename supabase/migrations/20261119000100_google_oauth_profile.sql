-- Update handle_new_user trigger to support Google OAuth display names (`name` or `full_name`)
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
