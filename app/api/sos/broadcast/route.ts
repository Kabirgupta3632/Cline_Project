// POST /api/sos/broadcast - notifies eligible donors for an SOS at its
// current radius_km and flips status to 'broadcasting'. Feature: sos (Person 1).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, type SosRequest } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import {
  findEligibleDonors,
  insertNotifications,
  getSosOrThrow,
  updateSosStatus,
  assertHospitalVerified,
} from "@/lib/matching";

const BodySchema = z.object({
  sos_id: z.string().uuid("sos_id must be a UUID"),
});

export interface SosBroadcastResponse {
  sos: SosRequest;
  notified_donor_ids: string[];
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
        apiError(`Cannot broadcast a ${sos.status} SOS request`),
        { status: 409 }
      );
    }

    // Rule 7 (anti-misuse / hospital verification gate): only verified
    // hospitals may notify civilian donors. Documented in docs/API_CONTRACT.md.
    try {
      await assertHospitalVerified(supabase, sos.hospital_id);
    } catch {
      return NextResponse.json(apiError("hospital_not_verified"), {
        status: 403,
      });
    }

    const donors = await findEligibleDonors(supabase, {
      sosId: sos.id,
      hospitalId: sos.hospital_id,
      bloodGroup: sos.blood_group,
      urgency: sos.urgency,
      radiusKm: sos.radius_km,
    });
    const notified_donor_ids = await insertNotifications(supabase, sos.id, donors);

    const updatedSos = await updateSosStatus(supabase, sos.id, {
      status: "broadcasting",
    });

    const response: SosBroadcastResponse = { sos: updatedSos, notified_donor_ids };
    return NextResponse.json(apiOk(response));
  } catch (err) {
    console.error("[api/sos/broadcast] unexpected error:", err);
    return NextResponse.json(
      apiError(err instanceof Error ? err.message : "Failed to broadcast SOS"),
      { status: 500 }
    );
  }
}
