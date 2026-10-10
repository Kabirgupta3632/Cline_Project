// GET /api/sos/list?hospital_id=uuid&status=broadcasting - lists SOS requests,
// optionally filtered by hospital and/or status. Feature: sos (Person 1).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, SosStatusEnum } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const QuerySchema = z.object({
  hospital_id: z.string().uuid().optional(),
  status: SosStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    hospital_id: searchParams.get("hospital_id") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      apiError(parsed.error.issues.map((i) => i.message).join("; ")),
      { status: 400 }
    );
  }
  const { hospital_id, status, limit } = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();
    let query = supabase
      .from("sos_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (hospital_id) query = query.eq("hospital_id", hospital_id);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      console.error("[api/sos/list] query failed:", error);
      return NextResponse.json(apiError("Failed to list SOS requests"), {
        status: 500,
      });
    }

    return NextResponse.json(apiOk(data ?? []));
  } catch (err) {
    console.error("[api/sos/list] unexpected error:", err);
    return NextResponse.json(apiError("Failed to list SOS requests"), {
      status: 500,
    });
  }
}
