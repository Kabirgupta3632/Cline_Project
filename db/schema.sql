-- RakshaRakt database schema (Postgres + PostGIS)
-- Feature: Infrastructure – run once on Supabase SQL editor before first deploy

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE blood_group_enum AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
CREATE TYPE urgency_enum AS ENUM ('normal','critical');
CREATE TYPE sos_status_enum AS ENUM ('inventory_check','broadcasting','fulfilled','cancelled');
CREATE TYPE notification_status_enum AS ENUM ('sent','accepted','declined','expired');
CREATE TYPE dispatch_status_enum AS ENUM ('en_route','arrived','donated','cancelled','ghosted');
CREATE TYPE transfer_status_enum AS ENUM ('pending','accepted','rejected','completed','cancelled');

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE hospitals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  location    GEOGRAPHY(Point, 4326) NOT NULL,
  address     TEXT NOT NULL,
  phone       TEXT NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE donors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  blood_group     blood_group_enum NOT NULL,
  location        GEOGRAPHY(Point, 4326) NOT NULL,
  phone           TEXT NOT NULL,
  last_donated_at TIMESTAMPTZ,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  snooze_until    TIMESTAMPTZ,
  hero_points     INT NOT NULL DEFAULT 0,
  total_donations INT NOT NULL DEFAULT 0,
  ghost_count     INT NOT NULL DEFAULT 0
);

CREATE TABLE sos_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id     UUID NOT NULL REFERENCES hospitals(id),
  blood_group     blood_group_enum NOT NULL,
  units_needed    INT NOT NULL,
  units_fulfilled INT NOT NULL DEFAULT 0,
  urgency         urgency_enum NOT NULL DEFAULT 'normal',
  status          sos_status_enum NOT NULL DEFAULT 'inventory_check',
  radius_km       NUMERIC NOT NULL DEFAULT 5,
  patient_note    TEXT,
  raw_slip_text   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sos_id       UUID NOT NULL REFERENCES sos_requests(id),
  donor_id     UUID NOT NULL REFERENCES donors(id),
  distance_km  NUMERIC NOT NULL,
  status       notification_status_enum NOT NULL DEFAULT 'sent',
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE TABLE dispatches (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sos_id           UUID NOT NULL REFERENCES sos_requests(id),
  donor_id         UUID NOT NULL REFERENCES donors(id),
  status           dispatch_status_enum NOT NULL DEFAULT 'en_route',
  accepted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_moving_at TIMESTAMPTZ,
  last_lat         NUMERIC,
  last_lng         NUMERIC,
  eta_minutes      INT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hospital_inventory (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id      UUID NOT NULL REFERENCES hospitals(id),
  blood_group      blood_group_enum NOT NULL,
  units_available  INT NOT NULL DEFAULT 0,
  units_reserved   INT NOT NULL DEFAULT 0,
  surplus_threshold INT NOT NULL DEFAULT 2,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(hospital_id, blood_group)
);

CREATE TABLE transfer_requests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sos_id           UUID NOT NULL REFERENCES sos_requests(id),
  from_hospital_id UUID NOT NULL REFERENCES hospitals(id),
  to_hospital_id   UUID NOT NULL REFERENCES hospitals(id),
  blood_group      blood_group_enum NOT NULL,
  units            INT NOT NULL,
  status           transfer_status_enum NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rewards_ledger (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donor_id   UUID NOT NULL REFERENCES donors(id),
  points     INT NOT NULL,
  reason     TEXT NOT NULL,
  sos_id     UUID REFERENCES sos_requests(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE badges (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donor_id   UUID NOT NULL REFERENCES donors(id),
  badge_code TEXT NOT NULL,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(donor_id, badge_code)
);

CREATE TABLE coupons (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner     TEXT NOT NULL,
  title       TEXT NOT NULL,
  points_cost INT NOT NULL,
  code        TEXT NOT NULL UNIQUE
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX donors_location_idx ON donors USING GIST(location);
CREATE INDEX hospitals_location_idx ON hospitals USING GIST(location);
CREATE INDEX notifications_donor_idx ON notifications(donor_id);
CREATE INDEX notifications_sos_idx ON notifications(sos_id);
CREATE INDEX dispatches_sos_idx ON dispatches(sos_id);
CREATE INDEX dispatches_donor_idx ON dispatches(donor_id);
CREATE INDEX inventory_hospital_group_idx ON hospital_inventory(hospital_id, blood_group);
