// GET /api/donor/dispatch?dispatch_id=uuid - fetch one dispatch row for the
// donor's en-route screen (initial load before any location ping). Feature:
// Donor API (Person 3). Proposed addition to API_CONTRACT.md (documented there).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import type { Dispatch } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const QuerySchema = z.object({
  dispatch_id: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const dispatchId = req.nextUrl.searchParams.get("dispatch_id");
  const parsed = QuerySchema.safeParse({ dispatch_id: dispatchId });
  if (!parsed.success) {
    return NextResponse.json(apiError("dispatch_id query param is required"), {
      status: 400,
    });
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("dispatches")
      .select("*")
      .eq("id", parsed.data.dispatch_id)
      .maybeSingle();

    if (error) {
      console.error("[api/donor/dispatch] query error:", error);
      return NextResponse.json(apiError("Failed to load dispatch"), {
        status: 500,
      });
    }
    if (!data) {
      return NextResponse.json(apiError("Dispatch not found"), { status: 404 });
    }

    return NextResponse.json(apiOk(data as Dispatch));
  } catch (err) {
    console.error("[api/donor/dispatch] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error loading dispatch"), {
      status: 500,
    });
  }
}
