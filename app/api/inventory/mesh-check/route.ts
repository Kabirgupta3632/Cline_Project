// POST /api/inventory/mesh-check - looks up nearby hospitals with surplus
// stock of a blood group (Inventory Mesh rule 4). Feature: inventory (Person 1).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, BloodGroupEnum } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { findSurplusHospitals } from "@/app/api/inventory/_lib/mesh";

const BodySchema = z.object({
  hospital_id: z.string().uuid("hospital_id must be a UUID"),
  blood_group: BloodGroupEnum,
  sos_id: z.string().uuid().optional(),
  radius_km: z.number().positive().max(200).default(15),
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
  const body = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();
    const surplus_hospitals = await findSurplusHospitals(supabase, {
      hospitalId: body.hospital_id,
      bloodGroup: body.blood_group,
      radiusKm: body.radius_km,
    });

    // sos_id is accepted for future audit-logging (e.g. recording that a
    // mesh-check was performed for a specific SOS) but not persisted yet -
    // it's purely informational at this stage of the hackathon build.
    return NextResponse.json(apiOk({ surplus_hospitals }));
  } catch (err) {
    console.error("[api/inventory/mesh-check] unexpected error:", err);
    return NextResponse.json(
      apiError(err instanceof Error ? err.message : "Mesh check failed"),
      { status: 500 }
    );
  }
}
