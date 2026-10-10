// GET /api/donor/profile?donor_id=uuid - donor's own profile + rewards data
// (badges, redeemable coupons, ledger history). Feature: Donor API (Person 3).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import type { Donor, Badge, Coupon, RewardsLedgerEntry } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const QuerySchema = z.object({
  donor_id: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const donorId = req.nextUrl.searchParams.get("donor_id");
  const parsed = QuerySchema.safeParse({ donor_id: donorId });
  if (!parsed.success) {
    return NextResponse.json(apiError("donor_id query param is required"), {
      status: 400,
    });
  }

  try {
    const supabase = getSupabaseServiceClient();

    // Donor row excludes the raw PostGIS `location` column - we never select
    // it directly over PostgREST (privacy + avoids WKB parsing), only the
    // plain scalar fields the rest of the app needs.
    const { data: donor, error: donorErr } = await supabase
      .from("donors")
      .select(
        "id, name, blood_group, phone, last_donated_at, is_available, snooze_until, hero_points, total_donations, ghost_count"
      )
      .eq("id", parsed.data.donor_id)
      .maybeSingle();

    if (donorErr) {
      console.error("[api/donor/profile] fetch donor error:", donorErr);
      return NextResponse.json(apiError("Failed to load donor"), {
        status: 500,
      });
    }
    if (!donor) {
      return NextResponse.json(apiError("Donor not found"), { status: 404 });
    }

    // Badges / coupons / ledger: read raw tables directly. Don't block on
    // Person 4's rewards business logic - just surface what's in the DB,
    // degrading to empty arrays if the tables don't exist yet / query fails.
    const [badgesRes, couponsRes, ledgerRes] = await Promise.all([
      supabase
        .from("badges")
        .select("*")
        .eq("donor_id", parsed.data.donor_id)
        .order("earned_at", { ascending: false }),
      supabase.from("coupons").select("*").order("points_cost", { ascending: true }),
      supabase
        .from("rewards_ledger")
        .select("*")
        .eq("donor_id", parsed.data.donor_id)
        .order("created_at", { ascending: false }),
    ]);

    const badges: Badge[] = badgesRes.error ? [] : (badgesRes.data as Badge[]) ?? [];
    const coupons_available: Coupon[] = couponsRes.error
      ? []
      : (couponsRes.data as Coupon[]) ?? [];
    const ledger: RewardsLedgerEntry[] = ledgerRes.error
      ? []
      : (ledgerRes.data as RewardsLedgerEntry[]) ?? [];

    if (badgesRes.error) {
      console.warn("[api/donor/profile] badges query failed (non-fatal):", badgesRes.error);
    }
    if (couponsRes.error) {
      console.warn("[api/donor/profile] coupons query failed (non-fatal):", couponsRes.error);
    }
    if (ledgerRes.error) {
      console.warn("[api/donor/profile] ledger query failed (non-fatal):", ledgerRes.error);
    }

    // `donor` here intentionally omits `location` (it isn't selected above);
    // callers in our own UI don't need it. Cast through unknown since the
    // shared Donor type declares `location` as required.
    return NextResponse.json(
      apiOk({
        donor: donor as unknown as Donor,
        badges,
        coupons_available,
        ledger,
      })
    );
  } catch (err) {
    console.error("[api/donor/profile] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error loading profile"), {
      status: 500,
    });
  }
}
