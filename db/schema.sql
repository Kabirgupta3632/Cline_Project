-- Core Postgres + PostGIS schema for RakshaRakt. Shared foundation (Person 2) -
-- every table referenced by sos/inventory/donor/dispatch/rewards features lives here.

-- Enable PostGIS for geography(Point) columns and ST_DWithin/ST_Distance queries.
create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type urgency_t as enum ('normal', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sos_status_t as enum ('inventory_check', 'broadcasting', 'fulfilled', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_status_t as enum ('sent', 'accepted', 'declined', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispatch_status_t as enum ('en_route', 'arrived', 'donated', 'cancelled', 'ghosted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transfer_status_t as enum ('requested', 'accepted', 'rejected', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type blood_group_t as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- hospitals
-- ---------------------------------------------------------------------------
create table if not exists hospitals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location geography(Point, 4326) not null,
  address text not null default '',
  phone text not null default '',
  verified boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists hospitals_location_gix on hospitals using gist (location);

-- ---------------------------------------------------------------------------
-- donors
-- ---------------------------------------------------------------------------
create table if not exists donors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  blood_group blood_group_t not null,
  location geography(Point, 4326) not null,
  phone text not null default '',
  last_donated_at timestamptz,
  is_available boolean not null default true,
  snooze_until timestamptz,
  hero_points int not null default 0,
  total_donations int not null default 0,
  ghost_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists donors_location_gix on donors using gist (location);
create index if not exists donors_blood_group_idx on donors (blood_group);

-- ---------------------------------------------------------------------------
-- sos_requests
-- ---------------------------------------------------------------------------
create table if not exists sos_requests (
  id uuid primary key default uuid_generate_v4(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  blood_group blood_group_t not null,
  units_needed int not null default 1,
  units_fulfilled int not null default 0,
  urgency urgency_t not null default 'normal',
  status sos_status_t not null default 'inventory_check',
  radius_km numeric not null default 5,
  patient_note text,
  raw_slip_text text,
  created_at timestamptz not null default now()
);

create index if not exists sos_requests_hospital_idx on sos_requests (hospital_id);
create index if not exists sos_requests_status_idx on sos_requests (status);

-- ---------------------------------------------------------------------------
-- notifications (one row per donor notified for an SOS)
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  sos_id uuid not null references sos_requests(id) on delete cascade,
  donor_id uuid not null references donors(id) on delete cascade,
  distance_km numeric not null,
  status notification_status_t not null default 'sent',
  sent_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists notifications_sos_idx on notifications (sos_id);
create index if not exists notifications_donor_idx on notifications (donor_id);
create unique index if not exists notifications_sos_donor_uq on notifications (sos_id, donor_id);

-- ---------------------------------------------------------------------------
-- dispatches (one row per donor who accepted an SOS and is en route)
-- ---------------------------------------------------------------------------
create table if not exists dispatches (
  id uuid primary key default uuid_generate_v4(),
  sos_id uuid not null references sos_requests(id) on delete cascade,
  donor_id uuid not null references donors(id) on delete cascade,
  status dispatch_status_t not null default 'en_route',
  accepted_at timestamptz not null default now(),
  started_moving_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  eta_minutes int,
  updated_at timestamptz not null default now()
);

create index if not exists dispatches_sos_idx on dispatches (sos_id);
create index if not exists dispatches_donor_idx on dispatches (donor_id);
create index if not exists dispatches_status_idx on dispatches (status);

-- ---------------------------------------------------------------------------
-- hospital_inventory (per-hospital, per-blood-group stock levels)
-- ---------------------------------------------------------------------------
create table if not exists hospital_inventory (
  id uuid primary key default uuid_generate_v4(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  blood_group blood_group_t not null,
  units_available int not null default 0,
  units_reserved int not null default 0,
  surplus_threshold int not null default 5,
  updated_at timestamptz not null default now()
);

create unique index if not exists hospital_inventory_hospital_group_uq
  on hospital_inventory (hospital_id, blood_group);

-- ---------------------------------------------------------------------------
-- transfer_requests (inter-hospital mesh transfers, rule 4)
-- ---------------------------------------------------------------------------
create table if not exists transfer_requests (
  id uuid primary key default uuid_generate_v4(),
  sos_id uuid references sos_requests(id) on delete set null,
  from_hospital_id uuid not null references hospitals(id) on delete cascade,
  to_hospital_id uuid not null references hospitals(id) on delete cascade,
  blood_group blood_group_t not null,
  units int not null default 1,
  status transfer_status_t not null default 'requested',
  created_at timestamptz not null default now()
);

create index if not exists transfer_requests_sos_idx on transfer_requests (sos_id);

-- ---------------------------------------------------------------------------
-- rewards_ledger / badges / coupons (rule 8)
-- ---------------------------------------------------------------------------
create table if not exists rewards_ledger (
  id uuid primary key default uuid_generate_v4(),
  donor_id uuid not null references donors(id) on delete cascade,
  points int not null,
  reason text not null,
  sos_id uuid references sos_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists rewards_ledger_donor_idx on rewards_ledger (donor_id);

create table if not exists badges (
  id uuid primary key default uuid_generate_v4(),
  donor_id uuid not null references donors(id) on delete cascade,
  badge_code text not null,
  earned_at timestamptz not null default now()
);

create unique index if not exists badges_donor_code_uq on badges (donor_id, badge_code);

create table if not exists coupons (
  id uuid primary key default uuid_generate_v4(),
  partner text not null,
  title text not null,
  points_cost int not null,
  code text not null
);

-- Donor <-> redeemed coupon join (tracks which donor redeemed which coupon copy).
create table if not exists coupon_redemptions (
  id uuid primary key default uuid_generate_v4(),
  donor_id uuid not null references donors(id) on delete cascade,
  coupon_id uuid not null references coupons(id) on delete cascade,
  redeemed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Realtime: enable full row payloads on UPDATE so the Notification Panel /
-- hospital dashboard can subscribe via Supabase Realtime (this IS the
-- "simulated push" per the product spec - no real push infra needed).
-- ---------------------------------------------------------------------------
alter table notifications replica identity full;
alter table dispatches replica identity full;
alter table sos_requests replica identity full;

-- Add these tables to the supabase_realtime publication (Supabase creates this
-- publication by default; this is idempotent-safe via exception handling).
do $$ begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table dispatches;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table sos_requests;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security: disabled for the hackathon (no auth system - rule says
-- "Auth is out of scope for 8 hours"). All access control happens in the
-- Next.js route handlers using the service-role key server-side.
-- ---------------------------------------------------------------------------
alter table hospitals disable row level security;
alter table donors disable row level security;
alter table sos_requests disable row level security;
alter table notifications disable row level security;
alter table dispatches disable row level security;
alter table hospital_inventory disable row level security;
alter table transfer_requests disable row level security;
alter table rewards_ledger disable row level security;
alter table badges disable row level security;
alter table coupons disable row level security;
alter table coupon_redemptions disable row level security;
