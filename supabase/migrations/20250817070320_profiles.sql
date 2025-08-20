-- drop old user_profiles table
drop table if exists public.user_profiles;

-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  display_name text,
  avatar_url text,
  updated_at timestamptz default now() not null
);


alter table profiles
  enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check ((select auth.uid()) = id);

create policy "Users can update own profile." on profiles
  for update using ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 1. Drop the existing foreign key constraint on the avoidance_areas table
ALTER TABLE public.avoidance_areas
DROP CONSTRAINT IF EXISTS avoidance_areas_user_id_fkey;

-- 2. Add a new foreign key constraint that points directly to the profiles table
ALTER TABLE public.avoidance_areas
ADD CONSTRAINT avoidance_areas_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles (id)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- 1. Drop the existing foreign key constraint on the avoidance_area_reports table
ALTER TABLE public.avoidance_area_reports
DROP CONSTRAINT IF EXISTS avoidance_area_reports_user_id_fkey;

-- 2. Add a new foreign key constraint that points directly to the profiles table
ALTER TABLE public.avoidance_area_reports
ADD CONSTRAINT avoidance_area_reports_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles (id)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- allow user_id column to be null in avoidance_area_reports
ALTER TABLE public.avoidance_area_reports
ALTER COLUMN user_id DROP NOT NULL;
