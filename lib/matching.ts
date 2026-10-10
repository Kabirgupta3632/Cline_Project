// Shared donor-matching/notification engine for SOS broadcast/escalate AND
// dispatch re-matching (ghost-sweep/cancel). Feature: sos + inventory (Person 1),
// extracted so Person 4's dispatch code never has to re-implement matching.
//
// Single source of truth for:
//   - rule 1 (compatibility)  -> delegates to lib/compat.ts#getEligibleDonorGroups
//   - rule 2 (eligibility)    -> delegates to the match_eligible_donors RPC
//   - rule 3 (radius/escalation) -> delegates to lib/geo.ts#currentEscalatedRadius
//   - rule 5 (dispatch fatigue)  -> implemented here, TS layer
//   - rule 6 (smart quiet hours) -> implemented here, TS layer
//   - rule 7 (hospital verification gate) -> implemented here, TS layer
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BloodGroup, SosRequest, SosStatus, Urgency } from "./types";
import { getEligibleDonorGroups } from "./compat";
import {
  currentEscalatedRadius,
  NORMAL_RADIUS_KM,
} from "./geo";

export interface MatchedDonorRow {
  donor_id: string;
  donor_name: string;
  blood_group: BloodGroup;
  phone: string;
  distance_km: number;
}

// ---------------------------------------------------------------------------
// Rule 6: Smart quiet hours - for urgency='normal' SOS only, donors are not
// disturbed between 23:00-06:00 local server time. Critical SOS always goes
// through regardless of the hour (life-threatening > sleep).
// Exact window documented in docs/API_CONTRACT.md - keep both in sync.
// ---------------------------------------------------------------------------
export const QUIET_HOURS_START = 23; // 11:00 PM (inclusive)
export const QUIET_HOURS_END = 6; // 6:00 AM (exclusive)

export function isWithinQuietHours(now: Date = new Date()): boolean {
  const hour = now.getHours();
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END;
}

// ---------------------------------------------------------------------------
// Rule 5: Dispatch fatigue guard - a donor who has already received 3+
// notifications (for ANY sos) in the last 24h is skipped for further normal
// broadcasts, so the same few close-by donors aren't spammed. Critical SOS
// bypasses this guard entirely (life-threatening > donor fatigue).
// ---------------------------------------------------------------------------
export const FATIGUE_WINDOW_HOURS = 24;
export const FATIGUE_MAX_NOTIFICATIONS = 3;

async function filterOutFatiguedDonors(
  supabase: SupabaseClient,
  donors: MatchedDonorRow[]
): Promise<MatchedDonorRow[]> {
  if (donors.length === 0) return donors;

  const cutoffIso = new Date(
    Date.now() - FATIGUE_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();
  const donorIds = donors.map((d) => d.donor_id);

  const { data, error } = await supabase
    .from("notifications")
    .select("donor_id")
    .in("donor_id", donorIds)
    .gte("sent_at", cutoffIso);

  if (error) {
    // Fail open on the fatigue guard - never block a broadcast because of a
    // secondary read error, that would be strictly worse than over-notifying.
    console.error("[lib/matching] fatigue guard query failed (non-fatal):", error);
    return donors;
  }

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { donor_id: string }[]) {
    counts.set(row.donor_id, (counts.get(row.donor_id) ?? 0) + 1);
  }

  return donors.filter(
    (d) => (counts.get(d.donor_id) ?? 0) < FATIGUE_MAX_NOTIFICATIONS
  );
}

// ---------------------------------------------------------------------------
// Rule 7: Hospital verification gate (anti-misuse) - only verified hospitals
// may notify civilian donors. Unverified hospitals can still create SOS rows
// and request inter-hospital transfers, but /api/sos/broadcast and the
// critical auto-broadcast path in /api/sos/create must refuse to notify any
// donor. Route handlers catch this thrown error and surface it as
// apiError("hospital_not_verified").
// ---------------------------------------------------------------------------
export async function assertHospitalVerified(
  supabase: SupabaseClient,
  hospitalId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("hospitals")
    .select("verified")
    .eq("id", hospitalId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check hospital verification: ${error.message}`);
  }
  if (!data) {
    throw new Error("Hospital not found");
  }
  if (!data.verified) {
    throw new Error("hospital_not_verified");
  }
}

// ---------------------------------------------------------------------------
// Core matching: calls match_eligible_donors RPC (rules 1+2+3 already
// enforced in SQL - compat groups, availability, snooze, 90-day cooldown,
// radius, not-already-notified), then applies the TS-layer rules 5+6 on top.
// ---------------------------------------------------------------------------
export async function findEligibleDonors(
  supabase: SupabaseClient,
  params: {
    sosId: string;
    hospitalId: string;
    bloodGroup: BloodGroup;
    urgency: Urgency;
    radiusKm: number;
  }
): Promise<MatchedDonorRow[]> {
  // Rule 6: quiet hours - normal SOS skip the broadcast entirely between
  // 23:00-06:00 (no donors returned at all; critical always bypasses this).
  if (params.urgency === "normal" && isWithinQuietHours()) {
    return [];
  }

  const bloodGroups = getEligibleDonorGroups(params.bloodGroup, params.urgency);

  const { data, error } = await supabase.rpc("match_eligible_donors", {
    p_sos_id: params.sosId,
    p_hospital_id: params.hospitalId,
    p_radius_km: params.radiusKm,
    p_blood_groups: bloodGroups,
  });

  if (error) {
    throw new Error(`match_eligible_donors RPC failed: ${error.message}`);
  }
  let donors = (data ?? []) as MatchedDonorRow[];

  // Rule 5: dispatch fatigue - skip donors over-notified in the last 24h,
  // UNLESS this SOS is critical (critical bypasses the fatigue guard too).
  if (params.urgency !== "critical") {
    donors = await filterOutFatiguedDonors(supabase, donors);
  }

  return donors;
}

/**
 * Inserts one 'sent' notification row per matched donor and returns the list
 * of donor ids actually notified. Uses upsert with ignoreDuplicates so a
 * retry (or an overlapping escalate/broadcast race) never double-notifies a
 * donor for the same sos_id (the DB also enforces this via a unique index on
 * (sos_id, donor_id)).
 */
export async function insertNotifications(
  supabase: SupabaseClient,
  sosId: string,
  donors: MatchedDonorRow[]
): Promise<string[]> {
  if (donors.length === 0) return [];

  const rows = donors.map((d) => ({
    sos_id: sosId,
    donor_id: d.donor_id,
    distance_km: d.distance_km,
    status: "sent" as const,
  }));

  const { data, error } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "sos_id,donor_id", ignoreDuplicates: true })
    .select("donor_id");

  if (error) {
    throw new Error(`Failed to insert notifications: ${error.message}`);
  }
  return (data ?? []).map((r: { donor_id: string }) => r.donor_id);
}

/** Fetches a single sos_requests row by id, throwing if not found. */
export async function getSosOrThrow(
  supabase: SupabaseClient,
  sosId: string
): Promise<SosRequest> {
  const { data, error } = await supabase
    .from("sos_requests")
    .select("*")
    .eq("id", sosId)
    .single();

  if (error || !data) {
    throw new Error(`SOS request not found: ${sosId}`);
  }
  return data as SosRequest;
}

/** Updates sos_requests.status (and optionally radius_km) and returns the new row. */
export async function updateSosStatus(
  supabase: SupabaseClient,
  sosId: string,
  patch: { status?: SosStatus; radius_km?: number }
): Promise<SosRequest> {
  const { data, error } = await supabase
    .from("sos_requests")
    .update(patch)
    .eq("id", sosId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update sos ${sosId}: ${error?.message}`);
  }
  return data as SosRequest;
}

// ---------------------------------------------------------------------------
// High-level entry points consumed directly by route handlers (sos + dispatch)
// ---------------------------------------------------------------------------

/**
 * Finds up to `count` next-best eligible donors for `sosId` who haven't
 * already been notified, notifies them, and returns the notified donor ids.
 * Used by:
 *   - /api/sos/broadcast (count = Infinity, i.e. notify everyone eligible)
 *   - /api/dispatch/cancel and /api/dispatch/ghost-sweep (count = 1, i.e.
 *     replace exactly the donor who cancelled/ghosted) - Person 4 should
 *     import this directly instead of re-implementing matching.
 * Throws `hospital_not_verified` if the owning hospital isn't verified
 * (rule 7). Callers should catch and translate to apiError("hospital_not_verified").
 */
export async function notifyNextDonors(
  supabase: SupabaseClient,
  sosId: string,
  count: number = Infinity
): Promise<string[]> {
  const sos = await getSosOrThrow(supabase, sosId);
  await assertHospitalVerified(supabase, sos.hospital_id);

  const candidates = await findEligibleDonors(supabase, {
    sosId: sos.id,
    hospitalId: sos.hospital_id,
    bloodGroup: sos.blood_group,
    urgency: sos.urgency,
    radiusKm: sos.radius_km,
  });
  // Already ordered by distance ascending (closest first) by the RPC.
  const toNotify = Number.isFinite(count) ? candidates.slice(0, count) : candidates;
  return insertNotifications(supabase, sos.id, toNotify);
}

/**
 * Widens a critical SOS's radius per the escalation ladder (rule 3) if
 * enough time has elapsed since creation, and notifies newly-eligible donors
 * at the new radius. Normal-urgency SOS stay fixed at NORMAL_RADIUS_KM but
 * still re-run matching so donors who just became eligible (snooze expired,
 * 90-day cooldown lapsed, quiet hours ended) get caught on each tick.
 * Returns the updated SOS row plus the list of newly-notified donor ids.
 */
export async function escalateIfNeeded(
  supabase: SupabaseClient,
  sosId: string
): Promise<{ sos: SosRequest; newlyNotifiedDonorIds: string[] }> {
  const sos = await getSosOrThrow(supabase, sosId);

  if (sos.status === "fulfilled" || sos.status === "cancelled") {
    return { sos, newlyNotifiedDonorIds: [] };
  }

  const newRadiusKm =
    sos.urgency === "critical"
      ? currentEscalatedRadius(sos.created_at).radiusKm
      : NORMAL_RADIUS_KM;

  // Persist the widened radius FIRST, then match/notify at that new radius -
  // notifyNextDonors re-fetches the sos row internally, so if we matched
  // before updating, it would (incorrectly) still use the old radius_km.
  const updatedSos = await updateSosStatus(supabase, sos.id, {
    status: sos.status === "inventory_check" ? "broadcasting" : sos.status,
    radius_km: newRadiusKm,
  });

  const newlyNotifiedDonorIds = await notifyNextDonors(supabase, sos.id);

  return { sos: updatedSos, newlyNotifiedDonorIds };
}
