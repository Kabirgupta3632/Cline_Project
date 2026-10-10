// GET /api/rewards/coupons - lists all redeemable partner coupons. Feature:
// rewards (Person 4).
import { NextResponse } from "next/server";
import { apiOk, apiError, type Coupon } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("points_cost", { ascending: true });

    if (error) {
      console.error("[api/rewards/coupons] query error:", error);
      return NextResponse.json(apiError("Failed to load coupons"), { status: 500 });
    }

    return NextResponse.json(apiOk((data ?? []) as Coupon[]));
  } catch (err) {
    console.error("[api/rewards/coupons] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error loading coupons"), {
      status: 500,
    });
  }
}
