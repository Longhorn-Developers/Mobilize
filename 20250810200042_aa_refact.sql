alter table public.avoidance_areas
    add column if not exists
    boundary_geojson jsonb generated always as (st_asgeojson(boundary::geometry)::jsonb) stored;

-- Drop the avoidance_areas_with_geojson view if it exists
drop view if exists public.avoidance_areas_with_geojson;
