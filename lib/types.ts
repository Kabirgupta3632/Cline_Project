// Shared TypeScript types and enums for RakshaRakt
// Feature: Global – frozen after hour 1; all teammates import from here

// ─── Enums ────────────────────────────────────────────────────────────────────

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type Urgency = 'normal' | 'critical';

export type SosStatus =
  | 'inventory_check'
  | 'broadcasting'
  | 'fulfilled'
  | 'cancelled';

export type NotificationStatus = 'sent' | 'accepted' | 'declined' | 'expired';

export type DispatchStatus =
  | 'en_route'
  | 'arrived'
  | 'donated'
  | 'cancelled'
  | 'ghosted';

export type TransferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type SnoozeOption = '1h' | '4h' | '24h' | 'today';

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface Hospital {
  id: string;
  name: string;
  /** PostGIS geography stored as {lat, lng} after RPC transform */
  location: GeoPoint;
  address: string;
  phone: string;
  verified: boolean;
}

export interface Donor {
  id: string;
  name: string;
  blood_group: BloodGroup;
  location: GeoPoint;
  phone: string;
  last_donated_at: string | null; // ISO timestamp
  is_available: boolean;
  snooze_until: string | null;    // ISO timestamp
  hero_points: number;
  total_donations: number;
  ghost_count: number;
}

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

export interface Notification {
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
  accepted_at: string;
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

export interface Badge {
  id: string;
  donor_id: string;
  badge_code: BadgeCode;
  earned_at: string;
}

export type BadgeCode =
  | 'first_responder'  // First Yes response
  | 'life_saver'       // 1 donation confirmed
  | 'hero'             // 5 donations
  | 'night_owl'        // Responded between 22:00-05:00
  | 'reliable';        // 3 arrivals with no ghost

export interface Coupon {
  id: string;
  partner: string;
  title: string;
  points_cost: number;
  code: string;
}

// ─── API Shapes ───────────────────────────────────────────────────────────────

/** Standard envelope returned by every API route */
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Lightweight geo point used across the app */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** AI slip extraction result */
export interface SlipExtraction {
  blood_group: BloodGroup | null;
  units: number | null;
  urgency: Urgency;
  hospital_name: string | null;
  patient_note: string | null;
  confidence: number; // 0-1
}

/** Inventory mesh match (nearby hospital with surplus) */
export interface InventoryMeshMatch {
  hospital_id: string;
  hospital_name: string;
  distance_km: number;
  units_available: number;
  units_reserved: number;
  surplus: number; // units_available - units_reserved - surplus_threshold
}

/** Donor profile with enriched fields for UI */
export interface DonorProfile extends Donor {
  badges: Badge[];
  ledger: RewardsLedgerEntry[];
  available_coupons: Coupon[];
}

/** Dispatch with donor info for hospital dashboard */
export interface DispatchWithDonor extends Dispatch {
  donor_name: string;
  donor_blood_group: BloodGroup;
  // NOTE: exact donor location is never returned to hospital UI (privacy rule #9)
}

/** SOS detail for hospital dashboard */
export interface SosDetail extends SosRequest {
  hospital_name: string;
  notifications_sent: number;
  notifications_accepted: number;
  dispatches: DispatchWithDonor[];
  inventory_matches: InventoryMeshMatch[];
}

// ─── Request Body Types (used by Zod schemas in API routes) ──────────────────

export interface CreateSosBody {
  hospital_id: string;
  blood_group: BloodGroup;
  units_needed: number;
  urgency: Urgency;
  patient_note?: string;
  raw_slip_text?: string;
}

export interface DonorRespondBody {
  notification_id: string;
  answer: 'yes' | 'no';
  snooze?: SnoozeOption;
}

export interface DonorLocationBody {
  donor_id: string;
  lat: number;
  lng: number;
}

export interface InventoryUpdateBody {
  blood_group: BloodGroup;
  units_available: number;
  units_reserved?: number;
  surplus_threshold?: number;
}

export interface TransferRequestBody {
  sos_id: string;
  from_hospital_id: string;
  to_hospital_id: string;
  blood_group: BloodGroup;
  units: number;
}

export interface RedeemCouponBody {
  donor_id: string;
  coupon_id: string;
}

export interface DispatchActionBody {
  dispatch_id?: string;
  donor_id?: string;
  sos_id?: string;
}
