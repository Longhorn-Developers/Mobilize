alter table "public"."avoidance_areas" enable row level security;

create policy "Enable insert for all users"
on "public"."avoidance_areas"
as permissive
for insert
to public
with check (true);


create policy "Enable read access for all users"
on "public"."avoidance_areas"
as permissive
for select
to public
using (true);



