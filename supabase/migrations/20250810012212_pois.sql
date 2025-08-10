CREATE EXTENSION IF NOT EXISTS pg_net with schema "extensions";
CREATE EXTENSION IF NOT EXISTS pg_cron with schema "extensions";

create table public.pois (
    id uuid primary key default gen_random_uuid(),
    name text,
    bld_name text,
    floor smallint,
    auto_opene bool not null,
    location geography not null,
    longitude float generated always as (ST_X(location::geometry)) stored,
    latitude float generated always as (ST_Y(location::geometry)) stored,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    
    UNIQUE (location, floor)
);
create index pois_location_idx on public.pois using GIST(location);
alter table public.pois enable row level security;
