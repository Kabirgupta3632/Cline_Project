// POST /api/demo/time-warp - shifts a dispatch accepted_at back by N minutes to test ghosting
// Feature: demo panel (Person 4)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const BodySchema = z.object({
  dispatch_id: z.string().uuid("dispatch_id must be a UUID").optional(),
  advance_minutes: z.number().optional()
});

const GHOST_WINDOW_MIN = Number(process.env.GHOST_WINDOW_MIN ?? 10);

export async function POST(req: NextRequest) {
  let json: unknown = {};
  try {
    const text = await req.text();
    if (text) json = JSON.parse(text);
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
  
  const advanceMinutes = parsed.data.advance_minutes || (GHOST_WINDOW_MIN + 1);

  try {
    const supabase = getSupabaseServiceClient();
    
    let query = supabase.from("dispatches").select("id, accepted_at").eq("status", "en_route");
    if (parsed.data.dispatch_id) query = query.eq("id", parsed.data.dispatch_id);
    
    const { data: dispatches } = await query;

    if (dispatches) {
      for (const d of dispatches) {
        if (!d.accepted_at) continue;
        const date = new Date(d.accepted_at);
        date.setMinutes(date.getMinutes() - advanceMinutes);
        await supabase.from("dispatches").update({ accepted_at: date.toISOString() }).eq("id", d.id);
      }
    }

    return NextResponse.json(apiOk({ warped_minutes: advanceMinutes, affected_count: dispatches?.length || 0 }));
  } catch (err) {
    return NextResponse.json(apiError("Unexpected error in time-warp"), { status: 500 });
  }
}
