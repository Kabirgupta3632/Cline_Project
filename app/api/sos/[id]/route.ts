// GET /api/sos/[id] - read-only aggregation of one SOS + its notifications and
// dispatches for the Hospital UI, with donor fields reduced to DonorPublic
// (privacy rule 9: hospital never sees donor exact location). Feature: Hospital UI (Person 2).
import { NextRequest, NextResponse } from "next/server";
import { apiOk, apiError } from "@/lib/types";
import type { DonorPublic, LatLng } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

// Narrows a raw donors row down to the privacy-safe public shape.
function toDonorPublic(d: Record<string, unknown> | null): DonorPublic | null {
  if (!d) return null;
  return {
    id: d.id as string,
    name: d.name as string,
    blood_group: d.blood_group as DonorPublic["blood_group"],
    is_available: d.is_available as boolean,
    hero_points: d.hero_points as number,
    total_donations: d.total_donations as number,
    ghost_count: d.ghost_count as number,
    last_donated_at: (d.last_donated_at as string) ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sosId = params.id;
  if (!sosId) {
    return NextResponse.json(apiError("Missing sos id"), { status: 400 });
  }

  try {
    const supabase = getSupabaseServiceClient();

    const { data: sos, error: sosErr } = await supabase
      .from("sos_requests")
      .select("*")
      .eq("id", sosId)
      .maybeSingle();

    if (sosErr) {
      console.error("[api/sos/[id]] sos query error:", sosErr);
      return NextResponse.json(apiError("Failed to load SOS"), { status: 500 });
    }
    if (!sos) {
      return NextResponse.json(apiError("SOS not found"), { status: 404 });
    }

    const [{ data: notifRows, error: notifErr }, { data: dispatchRows, error: dispatchErr }] =
      await Promise.all([
        supabase
          .from("notifications")
          .select(
            "id, donor_id, distance_km, status, sent_at, donors(id, name, blood_group, is_available, hero_points, total_donations, ghost_count, last_donated_at)"
          )
          .eq("sos_id", sosId)
          .order("sent_at", { ascending: false }),
        supabase
          .from("dispatches")
          .select(
            "id, donor_id, status, eta_minutes, accepted_at, donors(id, name, blood_group, is_available, hero_points, total_donations, ghost_count, last_donated_at)"
          )
          .eq("sos_id", sosId)
          .order("accepted_at", { ascending: false }),
      ]);

    if (notifErr || dispatchErr) {
      console.error("[api/sos/[id]] join error:", notifErr ?? dispatchErr);
      return NextResponse.json(apiError("Failed to load notifications/dispatches"), {
        status: 500,
      });
    }

    const notifications = (notifRows ?? []).map((n) => ({
      id: n.id,
      donor_id: n.donor_id,
      distance_km: n.distance_km,
      status: n.status,
      sent_at: n.sent_at,
      // Supabase nested select returns an object or array depending on join
      // direction; normalize defensively to a single record.
      donor: toDonorPublic(
        Array.isArray(n.donors) ? n.donors[0] ?? null : (n.donors as Record<string, unknown> | null)
      ),
    }));

    const dispatches = (dispatchRows ?? []).map((d) => ({
      id: d.id,
      donor_id: d.donor_id,
      status: d.status,
      eta_minutes: d.eta_minutes,
      accepted_at: d.accepted_at,
      donor: toDonorPublic(
        Array.isArray(d.donors) ? d.donors[0] ?? null : (d.donors as Record<string, unknown> | null)
      ),
    }));

    // Resolve the hospital's plain lat/lng (for the mini-map) via the shared
    // get_hospital_latlng RPC - never select the raw PostGIS geography column
    // directly over PostgREST. Non-fatal if it fails (map just hides).
    let hospital_location: LatLng | null = null;
    try {
      const { data: hospitalLoc, error: hospitalLocErr } = await supabase.rpc(
        "get_hospital_latlng",
        { p_hospital_id: sos.hospital_id }
      );
      if (!hospitalLocErr && hospitalLoc && hospitalLoc[0]) {
        hospital_location = { lat: hospitalLoc[0].lat, lng: hospitalLoc[0].lng };
      }
    } catch (err) {
      console.error("[api/sos/[id]] get_hospital_latlng failed (non-fatal):", err);
    }

    return NextResponse.json(
      apiOk({ sos, notifications, dispatches, hospital_location })
    );
  } catch (err) {
    console.error("[api/sos/[id]] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error loading SOS detail"), {
      status: 500,
    });
  }
}
