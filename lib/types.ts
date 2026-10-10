// Shared domain types & API response contract for RakshaRakt. FROZEN after hour 1 -
// every feature area (sos, inventory, donor, dispatch, rewards, ai) imports from here.
import { z } from "zod";

// ---------- Enums (as zod enums so route handlers can reuse for validation) ----------
export const BloodGroupEnum = z.enum([
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
]);
export type BloodGroup = z.infer<typeof BloodGroupEnum>;

export const UrgencyEnum = z.enum(["normal", "critical"]);
export type Urgency = z.infer<typeof UrgencyEnum>;

export const SosStatusEnum = z.enum([
  "inventory_check",
  "broadcasting",
  "fulfilled",
  "cancelled",
]);
export type SosStatus = z.infer<typeof SosStatusEnum>;

export const NotificationStatusEnum = z.enum([
  "sent",
  "accepted",
  "declined",
  "expired",
]);
export type NotificationStatus = z.infer<typeof NotificationStatusEnum>;

export const DispatchStatusEnum = z.enum([
  "en_route",
  "arrived",
  "donated",
  "cancelled",
  "ghosted",
]);
export type DispatchStatus = z.infer<typeof DispatchStatusEnum>;

export const TransferStatusEnum = z.enum([
  "requested",
  "accepted",
  "rejected",
  "completed",
]);
export type TransferStatus = z.infer<typeof TransferStatusEnum>;

export const SnoozeOptionEnum = z.enum(["1h", "4h", "24h", "today"]);
export type SnoozeOption = z.infer<typeof SnoozeOptionEnum>;

// Role switcher - no real auth for the hackathon, just a "Login as" dropdown.
export const RoleEnum = z.enum(["hospital", "donor", "demo"]);
export type Role = z.infer<typeof RoleEnum>;

// ---------- Geo helper shape ----------
// Plain lat/lng pair used at the API boundary. PostGIS geography columns are
// stored server-side; we never leak raw geometry types to the client.
export interface LatLng {
  lat: number;
  lng: number;
}

// ---------- Core entities (mirrors db/schema.sql) ----------
export interface Hospital {
  id: string;
  name: string;
  location: LatLng;
  address: string;
  phone: string;
  verified: boolean;
}

export interface Donor {
  id: string;
  name: string;
  blood_group: BloodGroup;
  location: LatLng;
  phone: string;
  last_donated_at: string | null;
  is_available: boolean;
  snooze_until: string | null;
  hero_points: number;
  total_donations: number;
  ghost_count: number;
}

// Donor record with location/phone stripped - what hospitals are allowed to see
// (privacy rule: hospital never sees donor exact location, only name/group/eta/status).
export type DonorPublic = Omit<Donor, "location" | "phone" | "snooze_until">;

export interface SosRequest {
  id: string;
  hospital_id: string;
  blood_group: BloodGroup;
  units_needed: number;
  units_fulfilled: number;
  urgency: Urgency;
  status: SosStatus;
  radius_km: number;
  patient_note: string | null;
  raw_slip_text: string | null;
  created_at: string;
}

export interface SosNotification {
  id: string;
  sos_id: string;
  donor_id: string;
  distance_km: number;
  status: NotificationStatus;
  sent_at: string;
  responded_at: string | null;
}

export interface Dispatch {
  id: string;
  sos_id: string;
  donor_id: string;
  status: DispatchStatus;
  accepted_at: string | null;
  started_moving_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  eta_minutes: number | null;
  updated_at: string;
}

export interface HospitalInventory {
  id: string;
  hospital_id: string;
  blood_group: BloodGroup;
  units_available: number;
  units_reserved: number;
  surplus_threshold: number;
  updated_at: string;
}

export interface TransferRequest {
  id: string;
  sos_id: string;
  from_hospital_id: string;
  to_hospital_id: string;
  blood_group: BloodGroup;
  units: number;
  status: TransferStatus;
  created_at: string;
}

export interface RewardsLedgerEntry {
  id: string;
  donor_id: string;
  points: number;
  reason: string;
  sos_id: string | null;
  created_at: string;
}

export const BadgeCodeEnum = z.enum([
  "first_responder",
  "life_saver",
  "hero",
  "night_owl",
  "reliable",
]);
export type BadgeCode = z.infer<typeof BadgeCodeEnum>;

export interface Badge {
  id: string;
  donor_id: string;
  badge_code: BadgeCode;
  earned_at: string;
}

export interface Coupon {
  id: string;
  partner: string;
  title: string;
  points_cost: number;
  code: string;
}

// ---------- API response envelope used by EVERY route handler ----------
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function apiOk<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function apiError(error: string): ApiResponse<never> {
  return { ok: false, error };
}
