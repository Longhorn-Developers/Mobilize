alter table public.avoidance_area_reports drop column title;
alter table public.avoidance_area_reports drop column description;

alter table public.avoidance_area_reports
add column description text not null;
alter table public.avoidance_area_reports
add column user_id uuid references auth.users (id) default auth.uid() not null;

-- allow anyone to select from the table
create policy "Allow public read access" on public.avoidance_area_reports 
for select 
using (
    true
);

-- TODO: REMOVE THIS IS TEMP TO ALLOW ALL TRUE, cuz no auth flow in app rn to test
-- allow users to insert their own reports
create policy "Allow individual insert access" on public.avoidance_area_reports 
for insert 
with check (
    -- (select auth.uid()) = user_id
    true
);

-- allow users to update their own reports
create policy "Allow individual update access" on public.avoidance_area_reports 
for update 
using (
    -- (select auth.uid()) = user_id
    true
);

-- allow users to delete their own reports
create policy "Allow individual delete access" on public.avoidance_area_reports 
for delete 
using (
    -- (select auth.uid()) = user_id
    true
);
