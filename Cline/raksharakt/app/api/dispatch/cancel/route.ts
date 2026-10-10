// POST /api/dispatch/cancel - donor/hospital cancels a dispatch; marks it
// 'cancelled' then re-matches the next best eligible donor for that SOS and
// notifies them. Feature: dispatch (Person 4, anti-ghosting rule).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, type Dispatch } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getSosOrThrow } from "@/app/api/sos/_lib/broadcast";
import { rematchAndNotifyNext } from "@/app/api/dispatch/_lib/rematch";

const BodySchema = z.object({
  dispatch_id: z.string().uuid("dispatch_id must be a UUID"),
  reason: z.string().max(500).optional(),
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
  const { dispatch_id } = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();

    const { data: updated, error: updateErr } = await supabase
      .from("dispatches")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", dispatch_id)
      .select("*, donors(name)")
      .single();

    if (updateErr || !updated) {
      console.error("[api/dispatch/cancel] update error:", updateErr);
      return NextResponse.json(apiError("Dispatch not found or failed to cancel"), {
        status: 404,
      });
    }
    const dispatch = updated as Dispatch;
    const donorName = (updated as any).donors?.name || "Unknown Donor";

    // Re-run matching for the next best eligible donor, excluding everyone
    // already notified for this sos_id (enforced inside match_eligible_donors).
    let replacement_notified: string | null = null;
    let replacementName = "No replacement found";
    try {
      const sos = await getSosOrThrow(supabase, dispatch.sos_id);
      if (sos.status !== "fulfilled" && sos.status !== "cancelled") {
        replacement_notified = await rematchAndNotifyNext(supabase, sos);
        if (replacement_notified) {
          const { data: replData } = await supabase.from("donors").select("name").eq("id", replacement_notified).single();
          if (replData) replacementName = replData.name;
        }
      }
    } catch (err) {
      console.error("[api/dispatch/cancel] rematch failed (non-fatal):", err);
    }
    
    // Log to dispatch_events
    await supabase.from("dispatch_events").insert({
      sos_id: dispatch.sos_id,
      event_type: "cancelled",
      message: `${donorName} cancelled -> notified ${replacementName}`
    });

    return NextResponse.json(apiOk({ dispatch, replacement_notified }));
  } catch (err) {
    console.error("[api/dispatch/cancel] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error cancelling dispatch"), {
      status: 500,
    });
  }
}
