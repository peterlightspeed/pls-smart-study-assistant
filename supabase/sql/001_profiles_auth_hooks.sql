-- Run in the Supabase SQL editor AFTER `alembic upgrade head` (which creates public.profiles).
-- Alembic owns app tables; this file owns everything that touches Supabase's `auth` schema.

-- 1. Tie profiles to auth users; deleting a user deletes their profile.
alter table public.profiles
  add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;

-- 2. Row Level Security: protects against direct access with the public anon key.
--    (The FastAPI backend connects with a privileged DB role that bypasses RLS, which is why
--    every service-layer query is also scoped by user_id: defense in depth.)
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- No insert/delete policies on purpose: rows are created by the trigger below and removed by cascade.

-- 3. Auto-provision a profile whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
