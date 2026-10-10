// POST /api/rewards/redeem - deducts hero points and marks a coupon as
// redeemed for a donor. Feature: rewards (Person 4).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const BodySchema = z.object({
  donor_id: z.string().uuid("donor_id must be a UUID"),
  coupon_id: z.string().uuid("coupon_id must be a UUID"),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(apiError("Invalid JSON body"), { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues.map((i) => i.message).join("; ")),
      { status: 400 }
    );
  }
  const { donor_id, coupon_id } = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();

    const [{ data: donor, error: donorErr }, { data: coupon, error: couponErr }] =
      await Promise.all([
        supabase.from("donors").select("hero_points").eq("id", donor_id).maybeSingle(),
        supabase.from("coupons").select("*").eq("id", coupon_id).maybeSingle(),
      ]);

    if (donorErr) {
      console.error("[api/rewards/redeem] donor fetch error:", donorErr);
      return NextResponse.json(apiError("Failed to load donor"), { status: 500 });
    }
    if (!donor) {
      return NextResponse.json(apiError("Donor not found"), { status: 404 });
    }
    if (couponErr) {
      console.error("[api/rewards/redeem] coupon fetch error:", couponErr);
      return NextResponse.json(apiError("Failed to load coupon"), { status: 500 });
    }
    if (!coupon) {
      return NextResponse.json(apiError("Coupon not found"), { status: 404 });
    }

    const heroPoints = donor.hero_points as number;
    const pointsCost = coupon.points_cost as number;
    if (heroPoints < pointsCost) {
      return NextResponse.json(apiError("insufficient_points"), { status: 409 });
    }

    const remaining_points = heroPoints - pointsCost;
    const { error: updateErr } = await supabase
      .from("donors")
      .update({ hero_points: remaining_points })
      .eq("id", donor_id);

    if (updateErr) {
      console.error("[api/rewards/redeem] update donor error:", updateErr);
      return NextResponse.json(apiError("Failed to deduct points"), { status: 500 });
    }

    const { error: redemptionErr } = await supabase
      .from("coupon_redemptions")
      .insert({ donor_id, coupon_id });

    if (redemptionErr) {
      console.error("[api/rewards/redeem] insert redemption error:", redemptionErr);
      // Points already deducted - still report success since the coupon
      // redemption intent happened; a retry of /api/rewards/coupons will
      // still show the coupon globally (we don't mark coupons as "used up"
      // globally, only track the donor's own redemption history).
      return NextResponse.json(apiError("Failed to record coupon redemption"), {
        status: 500,
      });
    }

    return NextResponse.json(apiOk({ redeemed: true, remaining_points }));
  } catch (err) {
    console.error("[api/rewards/redeem] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error redeeming coupon"), {
      status: 500,
    });
  }
}
