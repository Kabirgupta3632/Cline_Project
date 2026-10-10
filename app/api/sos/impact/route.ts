// GET /api/sos/impact - cross-feature read aggregation for judges: total SOS
// fulfilled, avg response time, donors currently active. Feature: Hospital UI
// impact dashboard (Person 2). Read-only; writes nothing.
import { NextRequest, NextResponse } from "next/server";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

export interface ImpactStats {
  total_sos: number;
  total_fulfilled: number;
  avg_response_minutes: number | null;
  donors_active_now: number;
  total_donations_confirmed: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Optional hospital_id filter - omit to aggregate platform-wide (useful for
  // a single "impact" slide covering every hospital in the demo).
  const hospitalId = searchParams.get("hospital_id") ?? undefined;

  try {
    const supabase = getSupabaseServiceClient();

    let sosQuery = supabase.from("sos_requests").select("id, status, created_at");
    if (hospitalId) sosQuery = sosQuery.eq("hospital_id", hospitalId);
    const { data: sosRows, error: sosErr } = await sosQuery;

    if (sosErr) {
      console.error("[api/sos/impact] sos query error:", sosErr);
      return NextResponse.json(apiError("Failed to load SOS stats"), { status: 500 });
    }

    const sosIds = (sosRows ?? []).map((s) => s.id as string);
    const total_sos = sosRows?.length ?? 0;
    const total_fulfilled = (sosRows ?? []).filter((s) => s.status === "fulfilled").length;

    // Average response time: accepted_at - sos.created_at across all
    // dispatches belonging to this hospital's SOS requests (or all, if no
    // hospital filter). A dispatch's accepted_at marks the moment a donor
    // said Yes, which is the "response" judges care about.
    let avg_response_minutes: number | null = null;
    let donors_active_now = 0;
    let total_donations_confirmed = 0;

    if (sosIds.length > 0) {
      const { data: dispatchRows, error: dispatchErr } = await supabase
        .from("dispatches")
        .select("sos_id, status, accepted_at")
        .in("sos_id", sosIds);

      if (dispatchErr) {
        console.error("[api/sos/impact] dispatch query error:", dispatchErr);
      } else if (dispatchRows) {
        const sosCreatedAt = new Map(
          (sosRows ?? []).map((s) => [s.id as string, s.created_at as string])
        );
        const responseTimesMin: number[] = [];
        for (const d of dispatchRows) {
          const createdAt = sosCreatedAt.get(d.sos_id as string);
          if (createdAt && d.accepted_at) {
            const diffMs = new Date(d.accepted_at as string).getTime() - new Date(createdAt).getTime();
            if (diffMs >= 0) responseTimesMin.push(diffMs / 60000);
          }
          if (d.status === "en_route" || d.status === "arrived") donors_active_now += 1;
          if (d.status === "donated") total_donations_confirmed += 1;
        }
        if (responseTimesMin.length > 0) {
          avg_response_minutes =
            Math.round(
              (responseTimesMin.reduce((a, b) => a + b, 0) / responseTimesMin.length) * 10
            ) / 10;
        }
      }
    }

    const stats: ImpactStats = {
      total_sos,
      total_fulfilled,
      avg_response_minutes,
      donors_active_now,
      total_donations_confirmed,
    };
    return NextResponse.json(apiOk(stats));
  } catch (err) {
    console.error("[api/sos/impact] unexpected error:", err);
    return NextResponse.json(apiError("Failed to compute impact stats"), { status: 500 });
  }
}
