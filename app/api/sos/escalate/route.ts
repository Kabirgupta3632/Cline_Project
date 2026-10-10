// POST /api/sos/escalate - widens an SOS's search radius per the escalation
// ladder and notifies newly-eligible donors only. Feature: sos (Person 1).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, type SosRequest } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getSosOrThrow, escalateIfNeeded } from "@/lib/matching";

const BodySchema = z.object({
  sos_id: z.string().uuid("sos_id must be a UUID"),
});

export interface SosEscalateResponse {
  sos: SosRequest;
  newly_notified: number;
  newly_notified_donor_ids: string[];
}

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

  const supabase = getSupabaseServiceClient();

  try {
    const sos = await getSosOrThrow(supabase, parsed.data.sos_id);

    if (sos.status === "fulfilled" || sos.status === "cancelled") {
      return NextResponse.json(
        apiError(`Cannot escalate a ${sos.status} SOS request`),
        { status: 409 }
      );
    }

    // escalateIfNeeded (lib/matching.ts) handles: rule 3 radius widening for
    // critical (fixed radius re-match for normal), rule 5 fatigue guard,
    // rule 6 quiet hours, and rule 7 hospital verification (throws
    // "hospital_not_verified" if the hospital isn't verified - caught below).
    let escalated;
    try {
      escalated = await escalateIfNeeded(supabase, sos.id);
    } catch (err) {
      if (err instanceof Error && err.message === "hospital_not_verified") {
        return NextResponse.json(apiError("hospital_not_verified"), {
          status: 403,
        });
      }
      throw err;
    }

    const response: SosEscalateResponse = {
      sos: escalated.sos,
      newly_notified: escalated.newlyNotifiedDonorIds.length,
      newly_notified_donor_ids: escalated.newlyNotifiedDonorIds,
    };
    return NextResponse.json(apiOk(response));
  } catch (err) {
    console.error("[api/sos/escalate] unexpected error:", err);
    return NextResponse.json(
      apiError(err instanceof Error ? err.message : "Failed to escalate SOS"),
      { status: 500 }
    );
  }
}

