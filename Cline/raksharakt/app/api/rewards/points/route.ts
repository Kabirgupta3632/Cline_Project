// POST /api/rewards/points - awards/deducts hero points for a donor action,
// inserts a rewards_ledger row, and runs the badge-check pass. Feature:
// rewards (Person 4).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { awardPoints } from "@/app/api/rewards/_lib/award";

const ReasonEnum = z.enum([
  "yes_response",
  "donation_confirmed",
  "critical_bonus",
  "ghosted",
]);

const BodySchema = z.object({
  donor_id: z.string().uuid("donor_id must be a UUID"),
  reason: ReasonEnum,
  sos_id: z.string().uuid().nullable().optional(),
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
  const { donor_id, reason, sos_id } = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();

    // Validate donor exists first so we return a clean 404 instead of a
    // confusing foreign-key error from the ledger insert.
    const { data: donorRow, error: donorErr } = await supabase
      .from("donors")
      .select("id")
      .eq("id", donor_id)
      .maybeSingle();
    if (donorErr) {
      console.error("[api/rewards/points] donor lookup error:", donorErr);
      return NextResponse.json(apiError("Failed to look up donor"), { status: 500 });
    }
    if (!donorRow) {
      return NextResponse.json(apiError("Donor not found"), { status: 404 });
    }

    const result = await awardPoints(supabase, {
      donor_id,
      reason,
      sos_id: sos_id ?? null,
    });

    return NextResponse.json(apiOk(result));
  } catch (err) {
    console.error("[api/rewards/points] unexpected error:", err);
    return NextResponse.json(
      apiError(err instanceof Error ? err.message : "Unexpected error awarding points"),
      { status: 500 }
    );
  }
}
