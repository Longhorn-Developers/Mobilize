CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

CREATE TYPE public.poi_type AS ENUM (
    'accessible_entrance'
);

create table public.pois (
    id uuid primary key default gen_random_uuid(),
    poi_type poi_type not null,
    metadata jsonb not null,
    location geography not null,
    location_geojson jsonb generated always as (st_asgeojson(location::geometry)::jsonb) stored,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique(poi_type, metadata, location)
);
create index pois_location_idx on public.pois using GIST(location);
alter table public.pois enable row level security;

alter table public.pois add constraint valid_accessible_entrance_metadata check (
    poi_type != 'accessible_entrance' or 
    jsonb_matches_schema('{
        "type": "object",
        "properties": {
            "name": {"type": ["string", "null"]},
            "bld_name": {"type": ["string", "null"]},
            "floor": {"type": ["integer", "null"]},
            "auto_opene": {"type": "boolean"}
        },
        "required": ["name", "bld_name", "floor", "auto_opene"]
    }', metadata)
);

create policy "Allow all users to select pois" on public.pois
    for select
    using (true);
