// Shared Inventory Mesh lookup logic reused by /api/inventory/mesh-check and
// /api/sos/create (private helper, not a route). Feature: inventory (Person 1).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BloodGroup } from "@/lib/types";

export interface SurplusHospitalRow {
  hospital_id: string;
  name: string;
  distance_km: number;
  units_available: number;
  units_reserved: number;
  surplus_threshold: number;
}

/**
 * Calls the find_surplus_hospitals RPC (rule 4): hospitals other than
 * p_hospitalId within p_radiusKm (default 15km) that have
 * units_available - units_reserved > surplus_threshold for p_bloodGroup.
 * Ordered by distance ascending (closest surplus first).
 */
export async function findSurplusHospitals(
  supabase: SupabaseClient,
  params: { hospitalId: string; bloodGroup: BloodGroup; radiusKm?: number }
): Promise<SurplusHospitalRow[]> {
  const { data, error } = await supabase.rpc("find_surplus_hospitals", {
    p_hospital_id: params.hospitalId,
    p_blood_group: params.bloodGroup,
    p_radius_km: params.radiusKm ?? 15,
  });

  if (error) {
    throw new Error(`find_surplus_hospitals RPC failed: ${error.message}`);
  }
  return (data ?? []) as SurplusHospitalRow[];
}
