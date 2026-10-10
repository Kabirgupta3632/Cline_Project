// GET /api/donor/notifications?donor_id=uuid - lists this donor's SOS
// notifications (joined with sos_requests + hospitals for display). Feature:
// Donor API (Person 3). Proposed addition to API_CONTRACT.md (documented there).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const QuerySchema = z.object({
  donor_id: z.string().min(1),
  status: z.enum(["sent", "accepted", "declined", "expired"]).optional(),
});

export async function GET(req: NextRequest) {
  const donorId = req.nextUrl.searchParams.get("donor_id");
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const parsed = QuerySchema.safeParse({ donor_id: donorId, status });
  if (!parsed.success) {
    return NextResponse.json(apiError("donor_id query param is required"), {
      status: 400,
    });
  }

  try {
    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from("notifications")
      .select(
        "id, sos_id, donor_id, distance_km, status, sent_at, responded_at, sos_requests(id, blood_group, units_needed, urgency, status, patient_note, created_at, hospital_id, hospitals(id, name, address))"
      )
      .eq("donor_id", parsed.data.donor_id)
      .order("sent_at", { ascending: false });

    if (parsed.data.status) {
      query = query.eq("status", parsed.data.status);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[api/donor/notifications] query error:", error);
      return NextResponse.json(apiError("Failed to load notifications"), {
        status: 500,
      });
    }

    const notifications = (data ?? []).map((n) => {
      const sos = Array.isArray(n.sos_requests)
        ? n.sos_requests[0] ?? null
        : (n.sos_requests as Record<string, unknown> | null);
      const hospital = sos
        ? Array.isArray((sos as Record<string, unknown>).hospitals)
          ? ((sos as Record<string, unknown>).hospitals as Record<string, unknown>[])[0] ?? null
          : ((sos as Record<string, unknown>).hospitals as Record<string, unknown> | null)
        : null;
      return {
        id: n.id,
        sos_id: n.sos_id,
        donor_id: n.donor_id,
        distance_km: n.distance_km,
        status: n.status,
        sent_at: n.sent_at,
        responded_at: n.responded_at,
        sos: sos
          ? {
              id: (sos as Record<string, unknown>).id,
              blood_group: (sos as Record<string, unknown>).blood_group,
              units_needed: (sos as Record<string, unknown>).units_needed,
              urgency: (sos as Record<string, unknown>).urgency,
              status: (sos as Record<string, unknown>).status,
              patient_note: (sos as Record<string, unknown>).patient_note,
              created_at: (sos as Record<string, unknown>).created_at,
              hospital_name: hospital ? (hospital as Record<string, unknown>).name : null,
              hospital_address: hospital ? (hospital as Record<string, unknown>).address : null,
            }
          : null,
      };
    });

    return NextResponse.json(apiOk(notifications));
  } catch (err) {
    console.error("[api/donor/notifications] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error loading notifications"), {
      status: 500,
    });
  }
}
