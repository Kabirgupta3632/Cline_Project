// Thin backward-compat wrapper around lib/matching.ts (private helper, not a
// route - "_lib" is excluded from Next.js routing). Feature: sos (Person 1).
//
// REFACTOR NOTE (Tier 2, step 4): all matching/notification logic previously
// lived directly in this file. It has been extracted to lib/matching.ts so
// that Person 4's dispatch code (cancel/ghost-sweep re-matching) can import
// notifyNextDonors()/escalateIfNeeded() directly instead of re-implementing
// matching. This file now just re-exports the same names so existing imports
// (`@/app/api/sos/_lib/broadcast`) across the codebase keep working unchanged.
export {
  findEligibleDonors,
  insertNotifications,
  getSosOrThrow,
  updateSosStatus,
  notifyNextDonors,
  escalateIfNeeded,
  type MatchedDonorRow,
} from "@/lib/matching";