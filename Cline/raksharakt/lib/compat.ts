// Blood type compatibility rules used for donor matching. Shared infra consumed
// by sos matching RPC params, ai/rank-donors, and dispatch re-matching.
import type { BloodGroup } from "./types";

/**
 * Donor compatibility map: for each blood group a PATIENT needs, which donor
 * blood groups are safe to transfuse. O- is the universal donor (present in
 * every list); AB+ is the universal recipient (needs the most groups listed
 * when critical, but as a donor AB+ can only give to AB+).
 */
const COMPATIBLE_DONORS: Record<BloodGroup, BloodGroup[]> = {
  "A+": ["A+", "A-", "O+", "O-"],
  "A-": ["A-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"], // universal recipient
  "AB-": ["AB-", "A-", "B-", "O-"],
  "O+": ["O+", "O-"],
  "O-": ["O-"], // can only receive from O- (universal donor group itself)
};

/**
 * Returns the ordered list of donor blood groups to notify for a given need.
 * - Normal urgency: ONLY the exact match group (strict, conserves donor goodwill).
 * - Critical urgency: exact match first, then the remaining compatible groups,
 *   so notification batching can still prioritize exact matches.
 */
export function getEligibleDonorGroups(
  neededGroup: BloodGroup,
  urgency: "normal" | "critical"
): BloodGroup[] {
  if (urgency === "normal") {
    return [neededGroup];
  }
  const compatible = COMPATIBLE_DONORS[neededGroup] ?? [neededGroup];
  // Exact match first, then the rest (de-duplicated, order preserved).
  const rest = compatible.filter((g) => g !== neededGroup);
  return [neededGroup, ...rest];
}

/** True if `donorGroup` may legally donate to a patient needing `neededGroup`. */
export function isCompatibleDonor(
  neededGroup: BloodGroup,
  donorGroup: BloodGroup
): boolean {
  return (COMPATIBLE_DONORS[neededGroup] ?? []).includes(donorGroup);
}

/** Exact-match check only (used for "normal" urgency filtering). */
export function isExactMatch(
  neededGroup: BloodGroup,
  donorGroup: BloodGroup
): boolean {
  return neededGroup === donorGroup;
}

/**
 * Simple ranking weight: exact match donors rank higher than compatible-only
 * donors, used as a tiebreaker alongside distance in rank-donors AI scoring.
 */
export function matchPriority(
  neededGroup: BloodGroup,
  donorGroup: BloodGroup
): number {
  return isExactMatch(neededGroup, donorGroup) ? 2 : 1;
}
