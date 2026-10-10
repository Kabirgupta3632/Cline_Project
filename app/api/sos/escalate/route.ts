// POST /api/sos/escalate - widens an SOS's search radius per the escalation
// ladder and notifies newly-eligible donors only. Feature: sos (Person 1).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, type SosRequest } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { currentEscalatedRadius, NORMAL_RADIUS_KM } from "@/lib/geo";
import {
  findEligibleDonors,
  insertNotifications,
  getSosOrThrow,
  updateSosStatus,
} from "@/app/api/sos/_lib/broadcast";

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

    // Only "critical" SOS requests have an escalation ladder (rule 3); normal
    // requests stay fixed at NORMAL_RADIUS_KM but we still re-run matching at
    // that radius so donors who recently became eligible (snooze expired,
    // 90-day cooldown lapsed) get caught on each escalate tick.
    const newRadiusKm =
      sos.urgency === "critical"
        ? currentEscalatedRadius(sos.created_at).radiusKm
        : NORMAL_RADIUS_KM;

    const donors = await findEligibleDonors(supabase, {
      sosId: sos.id,
      hospitalId: sos.hospital_id,
      bloodGroup: sos.blood_group,
      urgency: sos.urgency,
      radiusKm: newRadiusKm,
    });
    // findEligibleDonors already excludes donors with an existing
    // notifications row for this sos_id (NOT EXISTS clause in the RPC), so
    // every row returned here is, by construction, newly eligible.
    const newly_notified_donor_ids = await insertNotifications(
      supabase,
      sos.id,
      donors
    );

    const updatedSos = await updateSosStatus(supabase, sos.id, {
      status: sos.status === "inventory_check" ? "broadcasting" : sos.status,
      radius_km: newRadiusKm,
    });

    const response: SosEscalateResponse = {
      sos: updatedSos,
      newly_notified: newly_notified_donor_ids.length,
      newly_notified_donor_ids,
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
