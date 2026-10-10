// POST /api/inventory/update-stock - upserts a hospital's per-blood-group
// stock levels (units_available/reserved/surplus_threshold). Feature:
// inventory (Person 1).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiOk,
  apiError,
  BloodGroupEnum,
  type HospitalInventory,
} from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const BodySchema = z.object({
  hospital_id: z.string().uuid("hospital_id must be a UUID"),
  blood_group: BloodGroupEnum,
  units_available: z.number().int().nonnegative(),
  units_reserved: z.number().int().nonnegative().default(0),
  surplus_threshold: z.number().int().nonnegative().default(5),
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

  if (body.units_reserved > body.units_available) {
    return NextResponse.json(
      apiError("units_reserved cannot exceed units_available"),
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("hospital_inventory")
      .upsert(
        {
          hospital_id: body.hospital_id,
          blood_group: body.blood_group,
          units_available: body.units_available,
          units_reserved: body.units_reserved,
          surplus_threshold: body.surplus_threshold,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "hospital_id,blood_group" }
      )
      .select("*")
      .single();

    if (error || !data) {
      console.error("[api/inventory/update-stock] upsert failed:", error);
      return NextResponse.json(apiError("Failed to update stock"), {
        status: 500,
      });
    }

    return NextResponse.json(apiOk(data as HospitalInventory));
  } catch (err) {
    console.error("[api/inventory/update-stock] unexpected error:", err);
    return NextResponse.json(apiError("Failed to update stock"), {
      status: 500,
    });
  }
}
