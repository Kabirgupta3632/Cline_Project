// POST /api/dispatch/eta - recomputes eta_minutes for a dispatch by joining
// dispatches -> sos_requests -> hospitals for destination lat/lng and using
// dispatches.last_lat/last_lng for the donor's current position. Feature:
// dispatch (Person 4).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { haversineKm, estimateEtaMinutes } from "@/lib/geo";

const BodySchema = z.object({
  dispatch_id: z.string().uuid("dispatch_id must be a UUID"),
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

    const { data: dispatchRow, error: dispatchErr } = await supabase
      .from("dispatches")
      .select("id, sos_id, last_lat, last_lng")
      .eq("id", dispatch_id)
      .maybeSingle();

    if (dispatchErr) {
      console.error("[api/dispatch/eta] fetch dispatch error:", dispatchErr);
      return NextResponse.json(apiError("Failed to load dispatch"), {
        status: 500,
      });
    }
    if (!dispatchRow) {
      return NextResponse.json(apiError("Dispatch not found"), { status: 404 });
    }
    if (dispatchRow.last_lat == null || dispatchRow.last_lng == null) {
      return NextResponse.json(
        apiError("Dispatch has no location ping yet - cannot compute ETA"),
        { status: 409 }
      );
    }

    const { data: sosRow, error: sosErr } = await supabase
      .from("sos_requests")
      .select("hospital_id")
      .eq("id", dispatchRow.sos_id)
      .maybeSingle();

    if (sosErr || !sosRow) {
      console.error("[api/dispatch/eta] fetch sos error:", sosErr);
      return NextResponse.json(apiError("Failed to load SOS for dispatch"), {
        status: 500,
      });
    }

    const { data: hospitalLoc, error: hospitalLocErr } = await supabase.rpc(
      "get_hospital_latlng",
      { p_hospital_id: sosRow.hospital_id }
    );

    if (hospitalLocErr || !hospitalLoc || !hospitalLoc[0]) {
      console.error("[api/dispatch/eta] get_hospital_latlng error:", hospitalLocErr);
      return NextResponse.json(apiError("Failed to resolve hospital location"), {
        status: 500,
      });
    }

    const distanceKm = haversineKm(
      { lat: dispatchRow.last_lat, lng: dispatchRow.last_lng },
      { lat: hospitalLoc[0].lat, lng: hospitalLoc[0].lng }
    );
    const eta_minutes = estimateEtaMinutes(distanceKm);

    const { error: updateErr } = await supabase
      .from("dispatches")
      .update({ eta_minutes, updated_at: new Date().toISOString() })
      .eq("id", dispatch_id);

    if (updateErr) {
      console.error("[api/dispatch/eta] update error:", updateErr);
      return NextResponse.json(apiError("Failed to update eta_minutes"), {
        status: 500,
      });
    }

    return NextResponse.json(apiOk({ dispatch_id, eta_minutes }));
  } catch (err) {
    console.error("[api/dispatch/eta] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error computing ETA"), {
      status: 500,
    });
  }
}
