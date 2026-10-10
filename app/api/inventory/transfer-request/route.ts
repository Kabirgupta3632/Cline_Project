// POST /api/inventory/transfer-request - creates an inter-hospital blood
// transfer request row (Inventory Mesh rule 4). Feature: inventory (Person 1).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, BloodGroupEnum, type TransferRequest } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const BodySchema = z
  .object({
    sos_id: z.string().uuid().nullable().optional(),
    from_hospital_id: z.string().uuid("from_hospital_id must be a UUID"),
    to_hospital_id: z.string().uuid("to_hospital_id must be a UUID"),
    blood_group: BloodGroupEnum,
    units: z.number().int().positive().default(1),
  })
  .refine((b) => b.from_hospital_id !== b.to_hospital_id, {
    message: "from_hospital_id and to_hospital_id must differ",
    path: ["to_hospital_id"],
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
    const { data, error } = await supabase
      .from("transfer_requests")
      .insert({
        sos_id: body.sos_id ?? null,
        from_hospital_id: body.from_hospital_id,
        to_hospital_id: body.to_hospital_id,
        blood_group: body.blood_group,
        units: body.units,
        status: "requested",
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("[api/inventory/transfer-request] insert failed:", error);
      return NextResponse.json(apiError("Failed to create transfer request"), {
        status: 500,
      });
    }

    return NextResponse.json(apiOk(data as TransferRequest), { status: 201 });
  } catch (err) {
    console.error("[api/inventory/transfer-request] unexpected error:", err);
    return NextResponse.json(apiError("Failed to create transfer request"), {
      status: 500,
    });
  }
}
