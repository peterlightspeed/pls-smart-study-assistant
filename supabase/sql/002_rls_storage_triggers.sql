-- Run in the Supabase SQL editor AFTER `alembic upgrade head` and 001_profiles_auth_hooks.sql.

-- 1. Foreign keys to auth.users so deleting a user cascades to all their data
alter table public.user_settings  add constraint user_settings_user_fkey  foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.goals          add constraint goals_user_fkey          foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.study_sessions add constraint study_sessions_user_fkey foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.notes          add constraint notes_user_fkey          foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.gallery_items  add constraint gallery_items_user_fkey  foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.categories     add constraint categories_user_fkey     foreign key (user_id) references auth.users (id) on delete cascade;

-- 2. Row Level Security. The API connects with a privileged role (bypasses RLS) and scopes every query by user_id;
--    these policies protect against anyone using the public anon key directly against the database.
alter table public.user_settings  enable row level security;
alter table public.goals          enable row level security;
alter table public.study_sessions enable row level security;
alter table public.notes          enable row level security;
alter table public.gallery_items  enable row level security;
alter table public.categories     enable row level security;

create policy "user_settings_own"  on public.user_settings  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals_own"          on public.goals          for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "study_sessions_own" on public.study_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes_own"          on public.notes          for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gallery_items_own"  on public.gallery_items  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Categories: everyone can read system defaults (user_id is null); users manage only their own.
create policy "categories_read"    on public.categories for select using (user_id is null or user_id = auth.uid());
create policy "categories_write"   on public.categories for all    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Private storage bucket for the gallery (files are served through short-lived signed URLs only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', false, 5242880, array['image/webp'])
on conflict (id) do nothing;
-- No storage.objects policies on purpose: only the backend (service-role key) reads/writes this bucket.

-- 4. Sign-up trigger now also creates the settings row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name') on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
