// POST /api/dispatch/en-route - upserts a dispatches row to status='en_route'
// for (sos_id, donor_id). Idempotent; usually called internally by
// /api/donor/respond on "yes" but also exposed directly for the demo panel.
// Feature: dispatch (Person 4).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, type Dispatch } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const BodySchema = z.object({
  sos_id: z.string().uuid("sos_id must be a UUID"),
  donor_id: z.string().uuid("donor_id must be a UUID"),
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
  const { sos_id, donor_id } = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();

    const { data: existing, error: existingErr } = await supabase
      .from("dispatches")
      .select("*")
      .eq("sos_id", sos_id)
      .eq("donor_id", donor_id)
      .maybeSingle();

    if (existingErr) {
      console.error("[api/dispatch/en-route] lookup error:", existingErr);
      return NextResponse.json(apiError("Failed to check existing dispatch"), {
        status: 500,
      });
    }

    let dispatch: Dispatch;
    if (existing) {
      const { data: updated, error: updateErr } = await supabase
        .from("dispatches")
        .update({
          status: "en_route",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updateErr || !updated) {
        console.error("[api/dispatch/en-route] update error:", updateErr);
        return NextResponse.json(apiError("Failed to update dispatch"), {
          status: 500,
        });
      }
      dispatch = updated as Dispatch;
    } else {
      const { data: created, error: insertErr } = await supabase
        .from("dispatches")
        .insert({
          sos_id,
          donor_id,
          status: "en_route",
          accepted_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (insertErr || !created) {
        console.error("[api/dispatch/en-route] insert error:", insertErr);
        return NextResponse.json(apiError("Failed to create dispatch"), {
          status: 500,
        });
      }
      dispatch = created as Dispatch;
    }

    return NextResponse.json(apiOk(dispatch));
  } catch (err) {
    console.error("[api/dispatch/en-route] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error creating dispatch"), {
      status: 500,
    });
  }
}
