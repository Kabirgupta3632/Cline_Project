-- Demo seed data for RakshaRakt: 3 hospitals + 25 donors around Guwahati/
-- Goalpara, Assam, inventory rows, and reward coupons. Feature: sos +
-- inventory (Person 1) - run after db/schema.sql and db/functions.sql.
--
-- Idempotent: fixed UUIDs + `on conflict (id) do nothing` so re-running this
-- file during the hackathon never duplicates rows.

-- ---------------------------------------------------------------------------
-- hospitals (3)
--   h1 Guwahati Medical College Hospital - the "requesting" hospital in demo
--   h2 Downtown Hospital, Guwahati       - close by, has the O- surplus
--   h3 Goalpara Civil Hospital            - far side, ~90km away (out of
--                                           normal/early-critical radius, in
--                                           range only after escalation)
-- ---------------------------------------------------------------------------
insert into hospitals (id, name, location, address, phone, verified) values
  ('11111111-1111-1111-1111-111111111101', 'Guwahati Medical College Hospital',
    ST_SetSRID(ST_MakePoint(91.7362, 26.1445), 4326)::geography,
    'Bhangagarh, Guwahati, Assam', '+91-361-2528000', true),
  ('11111111-1111-1111-1111-111111111102', 'Downtown Hospital Guwahati',
    ST_SetSRID(ST_MakePoint(91.7898, 26.1584), 4326)::geography,
    'Dispur, Guwahati, Assam', '+91-361-2340031', true),
  ('11111111-1111-1111-1111-111111111103', 'Goalpara Civil Hospital',
    ST_SetSRID(ST_MakePoint(90.6263, 26.1693), 4326)::geography,
    'Goalpara Town, Goalpara, Assam', '+91-3663-220234', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- donors (25) - mixed blood groups around Guwahati (26.14-26.20, 91.60-91.85)
-- with 3 clustered near Goalpara (~26.17, 90.62) to exercise wide-radius
-- critical escalation. Includes deliberate eligibility-rule test cases:
--   d04 donated 10 days ago       -> must be EXCLUDED (within 90-day cooldown)
--   d09 is_available = false      -> must be EXCLUDED
--   d14 snoozed 24h in the future -> must be EXCLUDED
--   d20 snooze already expired    -> must be INCLUDED (snooze_until in past)
--   d06 donated exactly 120 days ago -> must be INCLUDED (outside cooldown)
-- ---------------------------------------------------------------------------
insert into donors (id, name, blood_group, location, phone, last_donated_at, is_available, snooze_until, hero_points, total_donations, ghost_count) values
  ('22222222-2222-2222-2222-222222220001', 'Rahul Sharma',   'O+',  ST_SetSRID(ST_MakePoint(91.7362, 26.1445), 4326)::geography, '+91-90001-00001', null, true, null, 120, 4, 0),
  ('22222222-2222-2222-2222-222222220002', 'Priya Das',      'A+',  ST_SetSRID(ST_MakePoint(91.7450, 26.1500), 4326)::geography, '+91-90001-00002', null, true, null, 80, 2, 0),
  ('22222222-2222-2222-2222-222222220003', 'Ankur Baruah',   'B+',  ST_SetSRID(ST_MakePoint(91.7510, 26.1390), 4326)::geography, '+91-90001-00003', null, true, null, 60, 1, 0),
  ('22222222-2222-2222-2222-222222220004', 'Moushumi Devi',  'O+',  ST_SetSRID(ST_MakePoint(91.7300, 26.1480), 4326)::geography, '+91-90001-00004', now() - interval '10 days', true, null, 40, 3, 0),
  ('22222222-2222-2222-2222-222222220005', 'Siddharth Kalita','AB+',ST_SetSRID(ST_MakePoint(91.7700, 26.1550), 4326)::geography, '+91-90001-00005', null, true, null, 20, 1, 0)
on conflict (id) do nothing;

insert into donors (id, name, blood_group, location, phone, last_donated_at, is_available, snooze_until, hero_points, total_donations, ghost_count) values
  ('22222222-2222-2222-2222-222222220006', 'Nilakshi Bora',  'O-',  ST_SetSRID(ST_MakePoint(91.7600, 26.1600), 4326)::geography, '+91-90001-00006', now() - interval '120 days', true, null, 200, 6, 0),
  ('22222222-2222-2222-2222-222222220007', 'Bikash Rabha',   'A-',  ST_SetSRID(ST_MakePoint(91.7250, 26.1420), 4326)::geography, '+91-90001-00007', null, true, null, 10, 0, 0),
  ('22222222-2222-2222-2222-222222220008', 'Dipika Saikia',  'B-',  ST_SetSRID(ST_MakePoint(91.7800, 26.1650), 4326)::geography, '+91-90001-00008', null, true, null, 30, 2, 1),
  ('22222222-2222-2222-2222-222222220009', 'Himangshu Deka', 'O+',  ST_SetSRID(ST_MakePoint(91.7400, 26.1470), 4326)::geography, '+91-90001-00009', null, false, null, 50, 2, 0),
  ('22222222-2222-2222-2222-222222220010', 'Rituparna Goswami','AB-', ST_SetSRID(ST_MakePoint(91.7550, 26.1510), 4326)::geography, '+91-90001-00010', null, true, null, 15, 1, 0)
on conflict (id) do nothing;

insert into donors (id, name, blood_group, location, phone, last_donated_at, is_available, snooze_until, hero_points, total_donations, ghost_count) values
  ('22222222-2222-2222-2222-222222220011', 'Jintu Hazarika', 'A+',  ST_SetSRID(ST_MakePoint(91.7650, 26.1530), 4326)::geography, '+91-90001-00011', null, true, null, 25, 1, 0),
  ('22222222-2222-2222-2222-222222220012', 'Lakhi Pathak',   'B+',  ST_SetSRID(ST_MakePoint(91.7150, 26.1350), 4326)::geography, '+91-90001-00012', null, true, null, 35, 2, 0),
  ('22222222-2222-2222-2222-222222220013', 'Mridusmita Nath','O+',  ST_SetSRID(ST_MakePoint(91.7480, 26.1620), 4326)::geography, '+91-90001-00013', null, true, null, 45, 3, 0),
  ('22222222-2222-2222-2222-222222220014', 'Kamal Boro',     'O-',  ST_SetSRID(ST_MakePoint(91.7380, 26.1410), 4326)::geography, '+91-90001-00014', null, true, now() + interval '24 hours', 5, 0, 0),
  ('22222222-2222-2222-2222-222222220015', 'Juri Medhi',     'AB+', ST_SetSRID(ST_MakePoint(91.7900, 26.1700), 4326)::geography, '+91-90001-00015', null, true, null, 10, 0, 0)
on conflict (id) do nothing;

insert into donors (id, name, blood_group, location, phone, last_donated_at, is_available, snooze_until, hero_points, total_donations, ghost_count) values
  ('22222222-2222-2222-2222-222222220016', 'Pranjal Gogoi',  'A-',  ST_SetSRID(ST_MakePoint(91.7200, 26.1480), 4326)::geography, '+91-90001-00016', null, true, null, 55, 3, 0),
  ('22222222-2222-2222-2222-222222220017', 'Sangeeta Rajkhowa','B-', ST_SetSRID(ST_MakePoint(91.7750, 26.1580), 4326)::geography, '+91-90001-00017', null, true, null, 65, 3, 0),
  ('22222222-2222-2222-2222-222222220018', 'Tridip Chetia',  'O+',  ST_SetSRID(ST_MakePoint(91.7340, 26.1540), 4326)::geography, '+91-90001-00018', null, true, null, 95, 4, 0),
  ('22222222-2222-2222-2222-222222220019', 'Babita Konwar',  'A+',  ST_SetSRID(ST_MakePoint(91.7620, 26.1460), 4326)::geography, '+91-90001-00019', null, true, null, 15, 1, 0),
  ('22222222-2222-2222-2222-222222220020', 'Ridip Phukan',   'O+',  ST_SetSRID(ST_MakePoint(91.7420, 26.1490), 4326)::geography, '+91-90001-00020', null, true, now() - interval '1 hour', 70, 3, 0)
on conflict (id) do nothing;

-- Goalpara-side cluster (3 donors, ~90km from Guwahati) - only reachable once
-- a critical SOS escalates its radius past ~90km (or used for far-side demo).
insert into donors (id, name, blood_group, location, phone, last_donated_at, is_available, snooze_until, hero_points, total_donations, ghost_count) values
  ('22222222-2222-2222-2222-222222220021', 'Mintu Rabha',    'O+',  ST_SetSRID(ST_MakePoint(90.6263, 26.1693), 4326)::geography, '+91-90001-00021', null, true, null, 5, 0, 0),
  ('22222222-2222-2222-2222-222222220022', 'Anjali Marak',   'B+',  ST_SetSRID(ST_MakePoint(90.6180, 26.1750), 4326)::geography, '+91-90001-00022', null, true, null, 5, 0, 0),
  ('22222222-2222-2222-2222-222222220023', 'Dilip Hajong',   'AB+', ST_SetSRID(ST_MakePoint(90.6350, 26.1620), 4326)::geography, '+91-90001-00023', null, true, null, 5, 0, 0)
on conflict (id) do nothing;

insert into donors (id, name, blood_group, location, phone, last_donated_at, is_available, snooze_until, hero_points, total_donations, ghost_count) values
  ('22222222-2222-2222-2222-222222220024', 'Farida Begum',   'A-',  ST_SetSRID(ST_MakePoint(91.7480, 26.1370), 4326)::geography, '+91-90001-00024', null, true, null, 12, 1, 0),
  ('22222222-2222-2222-2222-222222220025', 'Gautam Sarma',   'B-',  ST_SetSRID(ST_MakePoint(91.7560, 26.1430), 4326)::geography, '+91-90001-00025', null, true, null, 18, 1, 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- hospital_inventory - all 3 hospitals x 8 blood groups.
-- Downtown Hospital (h2) carries a clear O- surplus: units_available (20) -
-- units_reserved (2) = 18 > surplus_threshold (5), so find_surplus_hospitals()
-- returns it for O- lookups. All other rows are deliberately NOT in surplus
-- (available - reserved <= threshold).
-- ---------------------------------------------------------------------------
insert into hospital_inventory (hospital_id, blood_group, units_available, units_reserved, surplus_threshold) values
  ('11111111-1111-1111-1111-111111111101', 'A+',  6, 1, 5),
  ('11111111-1111-1111-1111-111111111101', 'A-',  3, 0, 5),
  ('11111111-1111-1111-1111-111111111101', 'B+',  5, 1, 5),
  ('11111111-1111-1111-1111-111111111101', 'B-',  2, 0, 5),
  ('11111111-1111-1111-1111-111111111101', 'AB+', 2, 0, 5),
  ('11111111-1111-1111-1111-111111111101', 'AB-', 1, 0, 5),
  ('11111111-1111-1111-1111-111111111101', 'O+',  7, 2, 5),
  ('11111111-1111-1111-1111-111111111101', 'O-',  1, 0, 5)
on conflict (hospital_id, blood_group) do update set
  units_available = excluded.units_available,
  units_reserved = excluded.units_reserved,
  surplus_threshold = excluded.surplus_threshold,
  updated_at = now();

insert into hospital_inventory (hospital_id, blood_group, units_available, units_reserved, surplus_threshold) values
  ('11111111-1111-1111-1111-111111111102', 'A+',  8, 3, 5),
  ('11111111-1111-1111-1111-111111111102', 'A-',  4, 1, 5),
  ('11111111-1111-1111-1111-111111111102', 'B+',  6, 2, 5),
  ('11111111-1111-1111-1111-111111111102', 'B-',  3, 1, 5),
  ('11111111-1111-1111-1111-111111111102', 'AB+', 4, 1, 5),
  ('11111111-1111-1111-1111-111111111102', 'AB-', 2, 0, 5),
  ('11111111-1111-1111-1111-111111111102', 'O+',  10, 4, 5),
  ('11111111-1111-1111-1111-111111111102', 'O-',  20, 2, 5) -- surplus: 18 > 5
on conflict (hospital_id, blood_group) do update set
  units_available = excluded.units_available,
  units_reserved = excluded.units_reserved,
  surplus_threshold = excluded.surplus_threshold,
  updated_at = now();

insert into hospital_inventory (hospital_id, blood_group, units_available, units_reserved, surplus_threshold) values
  ('11111111-1111-1111-1111-111111111103', 'A+',  3, 1, 5),
  ('11111111-1111-1111-1111-111111111103', 'A-',  1, 0, 5),
  ('11111111-1111-1111-1111-111111111103', 'B+',  2, 0, 5),
  ('11111111-1111-1111-1111-111111111103', 'B-',  1, 0, 5),
  ('11111111-1111-1111-1111-111111111103', 'AB+', 1, 0, 5),
  ('11111111-1111-1111-1111-111111111103', 'AB-', 0, 0, 5),
  ('11111111-1111-1111-1111-111111111103', 'O+',  4, 1, 5),
  ('11111111-1111-1111-1111-111111111103', 'O-',  2, 0, 5)
on conflict (hospital_id, blood_group) do update set
  units_available = excluded.units_available,
  units_reserved = excluded.units_reserved,
  surplus_threshold = excluded.surplus_threshold,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- coupons (5) - fake partner rewards for the donor rewards feature (Person 4
-- consumes these via GET /api/rewards/coupons, but they live in this schema).
-- ---------------------------------------------------------------------------
insert into coupons (id, partner, title, points_cost, code) values
  ('33333333-3333-3333-3333-333333333001', 'Zomato', '₹100 off your next order', 150, 'RAKSHA-ZOM-100'),
  ('33333333-3333-3333-3333-333333333002', 'BookMyShow', 'Buy 1 Get 1 movie ticket', 200, 'RAKSHA-BMS-B1G1'),
  ('33333333-3333-3333-3333-333333333003', 'Amazon', '₹150 Amazon Pay voucher', 250, 'RAKSHA-AMZN-150'),
  ('33333333-3333-3333-3333-333333333004', 'Swiggy', '₹75 off orders above ₹299', 100, 'RAKSHA-SWGY-75'),
  ('33333333-3333-3333-3333-333333333005', 'Decathlon', '10% off sportswear', 120, 'RAKSHA-DECA-10P')
on conflict (id) do nothing;
