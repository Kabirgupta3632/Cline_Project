// Shared matching/notification logic reused by /api/sos/broadcast and
// /api/sos/escalate (private helper, not a route - "_lib" is excluded from
// Next.js routing). Feature: sos (Person 1).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BloodGroup, SosRequest, SosStatus, Urgency } from "@/lib/types";
import { getEligibleDonorGroups } from "@/lib/compat";

export interface MatchedDonorRow {
  donor_id: string;
  donor_name: string;
  blood_group: BloodGroup;
  phone: string;
  distance_km: number;
}

/**
 * Calls the match_eligible_donors RPC for the given sos/hospital/radius,
 * restricting to the blood groups eligible per lib/compat.ts for this
 * (blood_group, urgency) pair. The RPC itself already excludes donors who:
 *   - are unavailable (is_available = false)
 *   - are currently snoozed (snooze_until > now())
 *   - donated within the last 90 days
 *   - already have a notifications row for this sos_id
 */
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
  return (data ?? []) as MatchedDonorRow[];
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
