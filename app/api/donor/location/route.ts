// POST /api/donor/location - donor client pings live lat/lng while en route;
// recomputes ETA and detects first movement (anti-ghost). Feature: Donor API (Person 3).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import type { Dispatch } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { haversineKm, estimateEtaMinutes } from "@/lib/geo";

const BodySchema = z.object({
  donor_id: z.string().min(1),
  dispatch_id: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// Movement threshold for "has the donor actually started moving" (anti-ghost
// rule): >50m from their reference position (home location at accept time,
// or their previous ping once one exists).
const MOVEMENT_THRESHOLD_KM = 0.05;

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
  const { donor_id, dispatch_id, lat, lng } = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();

    const { data: dispatchRow, error: dispatchErr } = await supabase
      .from("dispatches")
      .select("*")
      .eq("id", dispatch_id)
      .maybeSingle();

    if (dispatchErr) {
      console.error("[api/donor/location] fetch dispatch error:", dispatchErr);
      return NextResponse.json(apiError("Failed to load dispatch"), {
        status: 500,
      });
    }
    if (!dispatchRow) {
      return NextResponse.json(apiError("Dispatch not found"), { status: 404 });
    }
    if (dispatchRow.donor_id !== donor_id) {
      return NextResponse.json(
        apiError("Dispatch does not belong to this donor"),
        { status: 403 }
      );
    }

    // Reference point for the "has moved" check: previous ping if we have
    // one, otherwise the donor's registered home location (first ping ever).
    let referenceLat: number | null = dispatchRow.last_lat;
    let referenceLng: number | null = dispatchRow.last_lng;

    if (referenceLat == null || referenceLng == null) {
      const { data: donorLoc, error: donorLocErr } = await supabase.rpc(
        "get_donor_latlng",
        { p_donor_id: donor_id }
      );
      if (donorLocErr) {
        console.error("[api/donor/location] get_donor_latlng error:", donorLocErr);
      } else if (donorLoc && donorLoc[0]) {
        referenceLat = donorLoc[0].lat;
        referenceLng = donorLoc[0].lng;
      }
    }

    let startedMovingAt = dispatchRow.started_moving_at as string | null;
    if (
      !startedMovingAt &&
      referenceLat != null &&
      referenceLng != null
    ) {
      const movedKm = haversineKm(
        { lat: referenceLat, lng: referenceLng },
        { lat, lng }
      );
      if (movedKm > MOVEMENT_THRESHOLD_KM) {
        startedMovingAt = new Date().toISOString();
      }
    }

    // Join dispatches -> sos_requests -> hospitals to get hospital location
    // for the ETA recompute.
    const { data: sosRow, error: sosErr } = await supabase
      .from("sos_requests")
      .select("hospital_id")
      .eq("id", dispatchRow.sos_id)
      .maybeSingle();

    if (sosErr) {
      console.error("[api/donor/location] fetch sos error:", sosErr);
      return NextResponse.json(apiError("Failed to load SOS for ETA calc"), {
        status: 500,
      });
    }

    let etaMinutes: number | null = dispatchRow.eta_minutes;
    if (sosRow?.hospital_id) {
      const { data: hospitalLoc, error: hospitalLocErr } = await supabase.rpc(
        "get_hospital_latlng",
        { p_hospital_id: sosRow.hospital_id }
      );
      if (hospitalLocErr) {
        console.error(
          "[api/donor/location] get_hospital_latlng error:",
          hospitalLocErr
        );
      } else if (hospitalLoc && hospitalLoc[0]) {
        const distanceKm = haversineKm(
          { lat, lng },
          { lat: hospitalLoc[0].lat, lng: hospitalLoc[0].lng }
        );
        etaMinutes = estimateEtaMinutes(distanceKm);
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from("dispatches")
      .update({
        last_lat: lat,
        last_lng: lng,
        started_moving_at: startedMovingAt,
        eta_minutes: etaMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dispatch_id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[api/donor/location] update dispatch error:", updateErr);
      return NextResponse.json(apiError("Failed to update dispatch location"), {
        status: 500,
      });
    }

    return NextResponse.json(apiOk(updated as Dispatch));
  } catch (err) {
    console.error("[api/donor/location] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error updating location"), {
      status: 500,
    });
  }
}
