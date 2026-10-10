// GET /api/rewards/badges?donor_id=uuid - lists all earned badges for a
// donor. Feature: rewards (Person 4).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, type Badge } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const QuerySchema = z.object({
  donor_id: z.string().uuid("donor_id must be a UUID"),
});

export async function GET(req: NextRequest) {
  const donorId = req.nextUrl.searchParams.get("donor_id");
  const parsed = QuerySchema.safeParse({ donor_id: donorId });
  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues.map((i) => i.message).join("; ")),
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("badges")
      .select("*")
      .eq("donor_id", parsed.data.donor_id)
      .order("earned_at", { ascending: false });

    if (error) {
      console.error("[api/rewards/badges] query error:", error);
      return NextResponse.json(apiError("Failed to load badges"), { status: 500 });
    }

    return NextResponse.json(apiOk((data ?? []) as Badge[]));
  } catch (err) {
    console.error("[api/rewards/badges] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error loading badges"), {
      status: 500,
    });
  }
}
