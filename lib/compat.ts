// Blood group compatibility rules for donor matching
// Feature: SOS Matching – used by /api/sos and SQL RPC donor-search functions

import type { BloodGroup } from './types';

/**
 * Full compatibility map: for each needed blood group, which donor groups can donate?
 * Rule: exact match always first; for CRITICAL add compatible groups.
 */
export const COMPATIBILITY_MAP: Record<BloodGroup, BloodGroup[]> = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-'], // universal donor
};

/**
 * Returns donor blood groups that can donate to a patient needing `needed`.
 * @param needed - Patient's required blood group
 * @param critical - If true, return all compatible groups; if false, exact match only
 */
export function getCompatibleDonorGroups(
  needed: BloodGroup,
  critical: boolean,
): BloodGroup[] {
  if (critical) {
    return COMPATIBILITY_MAP[needed];
  }
  // Normal urgency: exact match only
  return [needed];
}

/**
 * Checks whether a donor with `donorGroup` can donate to a patient needing `needed`.
 */
export function canDonate(donorGroup: BloodGroup, needed: BloodGroup): boolean {
  return COMPATIBILITY_MAP[needed].includes(donorGroup);
}

/**
 * Sorts blood groups: exact match first, then O- (universal), then rest.
 * Used to prioritise the notification queue.
 */
export function sortByPriority(
  groups: BloodGroup[],
  needed: BloodGroup,
): BloodGroup[] {
  return [...groups].sort((a, b) => {
    if (a === needed) return -1;
    if (b === needed) return 1;
    if (a === 'O-') return -1;
    if (b === 'O-') return 1;
    return 0;
  });
}
