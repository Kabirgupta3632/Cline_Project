-- RPC helper(s) needed by /app/api/dispatch/** that aren't covered by
-- db/functions.sql (owned by Person 1). Feature: dispatch (Person 4).
--
-- /api/dispatch/eta computes ETA client-side in TypeScript via
-- lib/geo.ts#haversineKm, which needs plain {lat,lng} numbers. Hospital
-- location is stored as geography(Point,4326) and supabase-js cannot parse
-- PostGIS WKB directly, so this tiny RPC extracts lat/lng server-side.
-- Run this file AFTER db/schema.sql (and alongside db/functions.sql) against
-- the same Supabase project.
-- NOTE: Person 3's /app/api/donor/location/route.ts already calls RPCs named
-- get_hospital_latlng(p_hospital_id) and get_donor_latlng(p_donor_id) - we
-- define both here (under the same names) so that route works, and reuse
-- get_hospital_latlng ourselves in /app/api/dispatch/eta.
create or replace function get_hospital_latlng(p_hospital_id uuid)
returns table (
  lat double precision,
  lng double precision
)
language sql
stable
as $$
  select ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
  from hospitals
  where id = p_hospital_id;
$$;

grant execute on function get_hospital_latlng(uuid)
  to anon, authenticated, service_role;

create or replace function get_donor_latlng(p_donor_id uuid)
returns table (
  lat double precision,
  lng double precision
)
language sql
stable
as $$
  select ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
  from donors
  where id = p_donor_id;
$$;

grant execute on function get_donor_latlng(uuid)
  to anon, authenticated, service_role;
