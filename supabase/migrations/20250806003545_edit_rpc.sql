
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.insert_avoidance_area(p_name text, p_wkt text, publisher_id text)
 RETURNS uuid
 LANGUAGE sql
AS $function$
  insert into public.avoidance_areas (
    name,
    boundary,
    user_id
  )
  values (
    p_name,
    ST_GeomFromText(p_wkt, 4326),
    publisher_id::uuid
  )
  returning id;
$function$
;


