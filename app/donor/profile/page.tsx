// Donor profile: hero points, badges, total donations, redeemable coupons.
// Feature: Donor UI (Person 3).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api-client";
import { getActiveDonorId, clearActiveDonor } from "../donor-session";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BloodGroupTag } from "@/components/ui/BloodGroupTag";
import type { Badge as BadgeRow, BadgeCode, Coupon, Donor, RewardsLedgerEntry } from "@/lib/types";

interface ProfileResponse {
  donor: Donor;
  badges: BadgeRow[];
  coupons_available: Coupon[];
  ledger: RewardsLedgerEntry[];
}

const BADGE_LABELS: Record<BadgeCode, { emoji: string; label: string }> = {
  first_responder: { emoji: "🥇", label: "First Responder" },
  life_saver: { emoji: "💉", label: "Life Saver" },
  hero: { emoji: "🦸", label: "Hero" },
  night_owl: { emoji: "🦉", label: "Night Owl" },
  reliable: { emoji: "🤝", label: "Reliable" },
};

export default function DonorProfilePage() {
  const router = useRouter();
  const [donorId, setDonorId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);

  const refresh = useCallback(async (id: string) => {
    const { data, error: err } = await apiGet<ProfileResponse>(
      `/api/donor/profile?donor_id=${id}`
    );
    if (err) setError(err);
    else {
      setError(null);
      setProfile(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = getActiveDonorId();
    if (!id) {
      router.replace("/donor");
      return;
    }
    setDonorId(id);
    refresh(id);
  }, [refresh, router]);

  async function handleRedeem(coupon: Coupon) {
    if (!donorId) return;
    setRedeemingId(coupon.id);
    setRedeemMsg(null);
    // /api/rewards/redeem belongs to Person 4 - mock locally if unavailable
    // so the demo flow doesn't dead-end.
    const { data, error: err } = await apiPost<{
      redeemed: boolean;
      remaining_points: number;
    }>("/api/rewards/redeem", { donor_id: donorId, coupon_id: coupon.id });
    setRedeemingId(null);
    if (err || !data) {
      setRedeemMsg(
        `⚠️ Redeem API not ready yet (${err ?? "no response"}). Would redeem "${coupon.title}" for ${coupon.points_cost} points.`
      );
      return;
    }
    setRedeemMsg(`🎉 Redeemed "${coupon.title}"! Code: ${coupon.code}`);
    refresh(donorId);
  }

  function handleLogout() {
    clearActiveDonor();
    router.push("/donor");
  }
  return (
    <main className="mx-auto min-h-screen max-w-md pb-10">
      <header className="flex items-center justify-between bg-raksha-700 px-4 py-4 text-white shadow-card">
        <div>
          <h1 className="text-lg font-bold">🏆 Your Profile</h1>
          <p className="text-xs text-raksha-100">RakshaRakt Rewards</p>
        </div>
        <button
          onClick={handleLogout}
          className="min-h-12 rounded-lg bg-raksha-800 px-3 py-2 text-sm hover:bg-raksha-900"
        >
          Switch
        </button>
      </header>

      <div className="px-4 py-6">
        {error && (
          <p className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Couldn&apos;t load profile yet ({error}).
          </p>
        )}
        {redeemMsg && (
          <p className="mb-4 rounded-lg border border-raksha-200 bg-raksha-50 px-4 py-3 text-sm text-raksha-700">
            {redeemMsg}
          </p>
        )}

        {loading || !profile ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <Card className="mb-4">
              <div className="mb-4 flex items-center gap-3">
                <BloodGroupTag bloodGroup={profile.donor.blood_group} size="lg" />
                <div>
                  <p className="font-semibold text-gray-800">{profile.donor.name}</p>
                  <p className="text-xs text-gray-400">
                    {profile.donor.total_donations} donation(s) · {profile.donor.ghost_count} ghost(s)
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-raksha-50 p-4 text-center">
                <p className="text-3xl font-bold text-raksha-700">
                  {profile.donor.hero_points}
                </p>
                <p className="text-xs text-gray-500">Hero Points</p>
              </div>
            </Card>

            <Card className="mb-4">
              <h2 className="mb-3 font-semibold text-gray-800">Badges</h2>
              {profile.badges.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No badges yet - respond to an SOS to start earning them!
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.badges.map((b) => (
                    <Badge key={b.id} tone="primary">
                      {BADGE_LABELS[b.badge_code]?.emoji ?? "🏅"}{" "}
                      {BADGE_LABELS[b.badge_code]?.label ?? b.badge_code}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 font-semibold text-gray-800">Redeem Coupons</h2>
              {profile.coupons_available.length === 0 ? (
                <p className="text-sm text-gray-400">No coupons available right now.</p>
              ) : (
                <ul className="space-y-3">
                  {profile.coupons_available.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-700">{c.title}</p>
                        <p className="text-xs text-gray-400">
                          {c.partner} · {c.points_cost} pts
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={
                          redeemingId === c.id ||
                          profile.donor.hero_points < c.points_cost
                        }
                        onClick={() => handleRedeem(c)}
                      >
                        {redeemingId === c.id ? "…" : "Redeem"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}


