-- RakshaRakt PostGIS RPC functions for geo donor/hospital queries
-- Feature: SOS Matching + Inventory Mesh – called from API route handlers

-- ─── Find eligible donors within radius ───────────────────────────────────────
-- Returns donors who:
--   1. Are within radius_km of the hospital
--   2. Have a compatible blood group
--   3. Are available (is_available=true)
--   4. Are not snoozed (snooze_until IS NULL OR snooze_until < NOW())
--   5. Have not donated in the past 90 days
--   6. Have NOT already been notified for this SOS
-- blood_groups_arr: array of compatible blood groups (e.g. '{A+,A-,O+,O-}')

CREATE OR REPLACE FUNCTION find_eligible_donors(
  hospital_lat    FLOAT,
  hospital_lng    FLOAT,
  radius_km       FLOAT,
  blood_groups_arr blood_group_enum[],
  sos_id_param    UUID
)
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  blood_group blood_group_enum,
  distance_km FLOAT,
  phone       TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.blood_group,
    ROUND(
      (ST_Distance(
        d.location,
        ST_SetSRID(ST_MakePoint(hospital_lng, hospital_lat), 4326)::geography
      ) / 1000.0)::NUMERIC, 2
    )::FLOAT AS distance_km,
    d.phone
  FROM donors d
  WHERE
    d.blood_group = ANY(blood_groups_arr)
    AND d.is_available = TRUE
    AND (d.snooze_until IS NULL OR d.snooze_until < NOW())
    AND (d.last_donated_at IS NULL OR d.last_donated_at < NOW() - INTERVAL '90 days')
    AND ST_DWithin(
      d.location,
      ST_SetSRID(ST_MakePoint(hospital_lng, hospital_lat), 4326)::geography,
      radius_km * 1000
    )
    AND d.id NOT IN (
      SELECT n.donor_id FROM notifications n WHERE n.sos_id = sos_id_param
    )
  ORDER BY distance_km ASC;
END;
$$;

-- ─── Find hospitals with surplus stock ────────────────────────────────────────
-- Returns hospitals within radius that have surplus of a given blood group.
-- surplus = units_available - units_reserved - surplus_threshold > 0

CREATE OR REPLACE FUNCTION find_surplus_hospitals(
  requesting_hospital_lat  FLOAT,
  requesting_hospital_lng  FLOAT,
  radius_km                FLOAT,
  blood_group_param        blood_group_enum,
  exclude_hospital_id      UUID
)
RETURNS TABLE (
  hospital_id     UUID,
  hospital_name   TEXT,
  distance_km     FLOAT,
  units_available INT,
  units_reserved  INT,
  surplus         INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id AS hospital_id,
    h.name AS hospital_name,
    ROUND(
      (ST_Distance(
        h.location,
        ST_SetSRID(ST_MakePoint(requesting_hospital_lng, requesting_hospital_lat), 4326)::geography
      ) / 1000.0)::NUMERIC, 2
    )::FLOAT AS distance_km,
    inv.units_available,
    inv.units_reserved,
    (inv.units_available - inv.units_reserved - inv.surplus_threshold) AS surplus
  FROM hospital_inventory inv
  JOIN hospitals h ON h.id = inv.hospital_id
  WHERE
    inv.blood_group = blood_group_param
    AND h.id != exclude_hospital_id
    AND (inv.units_available - inv.units_reserved - inv.surplus_threshold) > 0
    AND ST_DWithin(
      h.location,
      ST_SetSRID(ST_MakePoint(requesting_hospital_lng, requesting_hospital_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_km ASC;
END;
$$;

-- ─── Update dispatch location and return new ETA ─────────────────────────────

CREATE OR REPLACE FUNCTION update_dispatch_location(
  dispatch_id_param UUID,
  new_lat           FLOAT,
  new_lng           FLOAT,
  hospital_lat      FLOAT,
  hospital_lng      FLOAT,
  avg_speed_kmh     FLOAT DEFAULT 25.0
)
RETURNS TABLE (dispatch_id UUID, eta_minutes INT)
LANGUAGE plpgsql
AS $$
DECLARE
  dist_m    FLOAT;
  dist_km   FLOAT;
  eta_min   INT;
BEGIN
  -- Calculate remaining distance to hospital
  SELECT ST_Distance(
    ST_SetSRID(ST_MakePoint(new_lng, new_lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(hospital_lng, hospital_lat), 4326)::geography
  ) INTO dist_m;

  dist_km := dist_m / 1000.0;
  -- ETA = travel time + 2 min buffer
  eta_min := CEIL((dist_km / avg_speed_kmh) * 60) + 2;

  UPDATE dispatches d
  SET
    last_lat = new_lat,
    last_lng = new_lng,
    started_moving_at = COALESCE(d.started_moving_at, NOW()),
    eta_minutes = eta_min,
    updated_at = NOW()
  WHERE d.id = dispatch_id_param;

  RETURN QUERY SELECT dispatch_id_param, eta_min;
END;
$$;
