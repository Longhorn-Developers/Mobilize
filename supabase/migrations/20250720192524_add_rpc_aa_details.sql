alter table "public"."avoidance_area_reports" disable row level security;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.insert_aa_details(aa_title text, aa_description text, aa_id uuid)
 RETURNS uuid
 LANGUAGE sql
AS $function$insert into public.avoidance_area_reports (
    avoidance_area_id,
    title,
    description
  )
  values (
    aa_id,
    aa_title,
    aa_description
  )
  returning avoidance_area_id;$function$
;


