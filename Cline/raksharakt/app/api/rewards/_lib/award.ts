// Shared "award points + check/insert new badges" logic reused by
// /api/rewards/points, /api/dispatch/confirm-donated, and
// /api/dispatch/ghost-sweep. Feature: rewards (Person 4).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Badge, BadgeCode, RewardsLedgerEntry } from "@/lib/types";
import { BadgeCodeEnum } from "@/lib/types";

export type RewardReason =
  | "yes_response"
  | "donation_confirmed"
  | "critical_bonus"
  | "ghosted";

export const POINTS_BY_REASON: Record<RewardReason, number> = {
  yes_response: 10,
  donation_confirmed: 50,
  critical_bonus: 25,
  ghosted: -10,
};

export interface AwardPointsResult {
  ledger_entry: RewardsLedgerEntry;
  new_total: number;
  new_badges: Badge[];
}

/**
 * Inserts a rewards_ledger row for `reason`, updates donors.hero_points by
 * the matching delta, then runs the badge-check pass. Never throws for
 * "donor not found" - callers should validate donor existence beforehand if
 * they need a 404; this function assumes the donor row exists.
 */
export async function awardPoints(
  supabase: SupabaseClient,
  params: { donor_id: string; reason: RewardReason; sos_id?: string | null }
): Promise<AwardPointsResult> {
  const points = POINTS_BY_REASON[params.reason];

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from("rewards_ledger")
    .insert({
      donor_id: params.donor_id,
      points,
      reason: params.reason,
      sos_id: params.sos_id ?? null,
    })
    .select("*")
    .single();

  if (ledgerErr || !ledgerRow) {
    throw new Error(`Failed to insert rewards_ledger row: ${ledgerErr?.message}`);
  }
  const ledger_entry = ledgerRow as RewardsLedgerEntry;

  const { data: donorRow, error: donorErr } = await supabase
    .from("donors")
    .select("hero_points, total_donations, ghost_count")
    .eq("id", params.donor_id)
    .single();

  if (donorErr || !donorRow) {
    throw new Error(`Failed to load donor ${params.donor_id}: ${donorErr?.message}`);
  }

  const new_total = Math.max(0, (donorRow.hero_points as number) + points);

  const { error: updateErr } = await supabase
    .from("donors")
    .update({ hero_points: new_total })
    .eq("id", params.donor_id);

  if (updateErr) {
    throw new Error(`Failed to update hero_points: ${updateErr.message}`);
  }

  const new_badges = await checkAndAwardBadges(supabase, params.donor_id, {
    ...ledger_entry,
    reason: params.reason,
  });

  return { ledger_entry, new_total, new_badges };
}

/**
 * Evaluates all 5 badge rules against the donor's current state + the
 * ledger entry that was just created, inserts any newly-earned badges
 * (unique index on (donor_id,badge_code) makes this idempotent/safe to
 * re-run), and returns only the badges newly inserted this call.
 */
export async function checkAndAwardBadges(
  supabase: SupabaseClient,
  donorId: string,
  justCreatedLedgerEntry: { reason: string; created_at: string }
): Promise<Badge[]> {
  const [{ data: donorRow, error: donorErr }, { data: existingBadges, error: badgeErr }] =
    await Promise.all([
      supabase
        .from("donors")
        .select("total_donations, ghost_count")
        .eq("id", donorId)
        .single(),
      supabase.from("badges").select("badge_code").eq("donor_id", donorId),
    ]);

  if (donorErr || !donorRow) {
    console.error("[rewards/award] checkAndAwardBadges donor fetch failed:", donorErr);
    return [];
  }
  if (badgeErr) {
    console.error("[rewards/award] checkAndAwardBadges badges fetch failed:", badgeErr);
  }

  const earned = new Set<BadgeCode>(
    ((existingBadges ?? []) as { badge_code: BadgeCode }[]).map((b) => b.badge_code)
  );
  const toAward: BadgeCode[] = [];

  // First Responder: the FIRST ever 'yes_response' or 'donation_confirmed'
  // ledger entry for this donor.
  if (
    !earned.has("first_responder") &&
    (justCreatedLedgerEntry.reason === "yes_response" ||
      justCreatedLedgerEntry.reason === "donation_confirmed")
  ) {
    const { count, error: countErr } = await supabase
      .from("rewards_ledger")
      .select("id", { count: "exact", head: true })
      .eq("donor_id", donorId)
      .in("reason", ["yes_response", "donation_confirmed"]);
    if (!countErr && (count ?? 0) <= 1) {
      toAward.push("first_responder");
    }
  }

  // Night Owl: responded (yes) between 10pm-5am local time.
  if (
    !earned.has("night_owl") &&
    justCreatedLedgerEntry.reason === "yes_response"
  ) {
    const hour = new Date(justCreatedLedgerEntry.created_at).getHours();
    if (hour >= 22 || hour < 5) {
      toAward.push("night_owl");
    }
  }

  // Life Saver: >=1 completed (confirmed) donation.
  if (!earned.has("life_saver") && (donorRow.total_donations as number) >= 1) {
    toAward.push("life_saver");
  }

  // Hero: >=5 completed donations.
  if (!earned.has("hero") && (donorRow.total_donations as number) >= 5) {
    toAward.push("hero");
  }

  // Reliable: 3 arrivals (status in ('arrived','donated')) with zero ghosts.
  if (!earned.has("reliable") && (donorRow.ghost_count as number) === 0) {
    const { count: arrivalCount, error: arrivalErr } = await supabase
      .from("dispatches")
      .select("id", { count: "exact", head: true })
      .eq("donor_id", donorId)
      .in("status", ["arrived", "donated"]);
    if (!arrivalErr && (arrivalCount ?? 0) >= 3) {
      toAward.push("reliable");
    }
  }

  if (toAward.length === 0) return [];

  const rows = toAward.map((badge_code) => ({ donor_id: donorId, badge_code }));
  const { data: inserted, error: insertErr } = await supabase
    .from("badges")
    .upsert(rows, { onConflict: "donor_id,badge_code", ignoreDuplicates: true })
    .select("*");

  if (insertErr) {
    console.error("[rewards/award] badge insert failed:", insertErr);
    return [];
  }
  return (inserted ?? []) as Badge[];
}

export { BadgeCodeEnum };
