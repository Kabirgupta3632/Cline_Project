// Shared "find the next best eligible donor and notify them" logic reused by
// /api/dispatch/cancel and /api/dispatch/ghost-sweep (anti-ghosting re-match).
// Feature: dispatch (Person 4).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SosRequest } from "@/lib/types";
import { findEligibleDonors, insertNotifications } from "@/app/api/sos/_lib/broadcast";

/**
 * Finds the single closest eligible donor for `sos` who hasn't already been
 * notified for it (match_eligible_donors RPC already excludes anyone with an
 * existing notifications row for this sos_id - see db/functions.sql) and
 * inserts a 'sent' notification row for them. Returns the notified donor_id,
 * or null if no eligible donor remains.
 */
export async function rematchAndNotifyNext(
  supabase: SupabaseClient,
  sos: SosRequest
): Promise<string | null> {
  const candidates = await findEligibleDonors(supabase, {
    sosId: sos.id,
    hospitalId: sos.hospital_id,
    bloodGroup: sos.blood_group,
    urgency: sos.urgency,
    radiusKm: sos.radius_km,
  });
  if (candidates.length === 0) return null;

  const next = candidates[0]; // already ordered by distance ascending
  const notified = await insertNotifications(supabase, sos.id, [next]);
  return notified[0] ?? null;
}
