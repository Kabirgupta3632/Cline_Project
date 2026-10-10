-- Postgres/PostGIS RPC functions for donor geo-matching & the inventory mesh
-- lookup. Feature: sos + inventory (Person 1) - called via supabase.rpc().
--
-- Design notes (deviation from the literal "takes blood_group, urgency,
-- hospital location, radius_km" wording in the task brief):
--   * Both functions take p_hospital_id (uuid) instead of raw lat/lng. The
--     hospital's geography(Point) is resolved server-side via a subquery on
--     the hospitals table. This avoids ever having to parse PostGIS WKB/EWKB
--     output back into {lat,lng} inside TypeScript route handlers - we never
--     select the `location` column directly over PostgREST, only use it
--     inside SQL via these RPCs.
--   * "urgency" is NOT a SQL parameter. lib/compat.ts#getEligibleDonorGroups
--     is the single source of truth for which blood groups are eligible for
--     a given (neededGroup, urgency) pair; route handlers compute that list
--     in TypeScript and pass the resolved blood_group_t[] array in. This
--     keeps the compatibility matrix defined in exactly one place.

-- ---------------------------------------------------------------------------
-- match_eligible_donors
--   Returns donors within p_radius_km of the hospital running p_sos_id,
--   restricted to p_blood_groups, who are:
--     - is_available = true
--     - not currently snoozed (snooze_until is null or already elapsed)
--     - not donated within the last 90 days (last_donated_at is null or
--       older than 90 days)
--     - not already notified for this sos_id (no existing notifications row)
--   Ordered by distance ascending (closest first).
-- ---------------------------------------------------------------------------
create or replace function match_eligible_donors(
  p_sos_id uuid,
  p_hospital_id uuid,
  p_radius_km numeric,
  p_blood_groups blood_group_t[]
)
returns table (
  donor_id uuid,
  donor_name text,
  blood_group blood_group_t,
  phone text,
  distance_km numeric
)
language sql
stable
as $$
  select
    d.id as donor_id,
    d.name as donor_name,
    d.blood_group,
    d.phone,
    round((ST_Distance(d.location, h.location) / 1000.0)::numeric, 2) as distance_km
  from donors d
  cross join (select location from hospitals where id = p_hospital_id) h
  where d.blood_group = any (p_blood_groups)
    and d.is_available = true
    and (d.snooze_until is null or d.snooze_until <= now())
    and (d.last_donated_at is null or d.last_donated_at <= now() - interval '90 days')
    and ST_DWithin(d.location, h.location, p_radius_km * 1000)
    and not exists (
      select 1 from notifications n
      where n.sos_id = p_sos_id and n.donor_id = d.id
    )
  order by distance_km asc;
$$;

grant execute on function match_eligible_donors(uuid, uuid, numeric, blood_group_t[])
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- find_surplus_hospitals
--   Inventory Mesh lookup (rule 4): hospitals other than p_hospital_id within
--   p_radius_km (default 15km) that have a clear surplus of p_blood_group,
--   i.e. units_available - units_reserved > surplus_threshold for that group.
--   Ordered by distance ascending (closest surplus first).
-- ---------------------------------------------------------------------------
create or replace function find_surplus_hospitals(
  p_hospital_id uuid,
  p_blood_group blood_group_t,
  p_radius_km numeric default 15
)
returns table (
  hospital_id uuid,
  name text,
  distance_km numeric,
  units_available int,
  units_reserved int,
  surplus_threshold int
)
language sql
stable
as $$
  select
    h.id as hospital_id,
    h.name,
    round((ST_Distance(h.location, origin.location) / 1000.0)::numeric, 2) as distance_km,
    hi.units_available,
    hi.units_reserved,
    hi.surplus_threshold
  from hospitals h
  join hospital_inventory hi
    on hi.hospital_id = h.id and hi.blood_group = p_blood_group
  cross join (select location from hospitals where id = p_hospital_id) as origin
  where h.id <> p_hospital_id
    and (hi.units_available - hi.units_reserved) > hi.surplus_threshold
    and ST_DWithin(h.location, origin.location, p_radius_km * 1000)
  order by distance_km asc;
$$;

grant execute on function find_surplus_hospitals(uuid, blood_group_t, numeric)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_hospital_latlng (Person 3 addition, additive - does not modify the two
-- functions above)
--   Returns a hospital's plain lat/lng as numbers so TypeScript route
--   handlers (e.g. app/api/donor/location ETA recompute) never need to parse
--   PostGIS WKB/EWKB geography output themselves.
-- ---------------------------------------------------------------------------
create or replace function get_hospital_latlng(p_hospital_id uuid)
returns table (lat double precision, lng double precision)
language sql
stable
as $$
  select ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
  from hospitals
  where id = p_hospital_id;
$$;

grant execute on function get_hospital_latlng(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- get_donor_latlng (Person 3 addition, additive)
--   Returns a donor's registered home lat/lng as numbers - used as the
--   baseline reference position for the anti-ghost "has the donor moved
--   >50m since accepting" check on their first location ping.
-- ---------------------------------------------------------------------------
create or replace function get_donor_latlng(p_donor_id uuid)
returns table (lat double precision, lng double precision)
language sql
stable
as $$
  select ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng
  from donors
  where id = p_donor_id;
$$;

grant execute on function get_donor_latlng(uuid)
  to anon, authenticated, service_role;
