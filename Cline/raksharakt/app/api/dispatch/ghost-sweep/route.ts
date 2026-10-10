// POST /api/dispatch/ghost-sweep - anti-ghosting sweep: finds en_route
// dispatches that never started moving within GHOST_WINDOW_MIN, marks them
// 'ghosted', penalizes the donor, and re-matches the next best donor for
// each affected SOS. Callable from the demo panel button AND a hospital
// dashboard poll. Feature: dispatch (Person 4).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { getSosOrThrow } from "@/app/api/sos/_lib/broadcast";
import { rematchAndNotifyNext } from "@/app/api/dispatch/_lib/rematch";
import { awardPoints } from "@/app/api/rewards/_lib/award";

const BodySchema = z.object({
  sos_id: z.string().uuid("sos_id must be a UUID").optional(),
});

const GHOST_WINDOW_MIN = Number(process.env.GHOST_WINDOW_MIN ?? 10);

export interface GhostSweepResponse {
  ghosted: string[]; // dispatch ids marked ghosted
  replacement_notified: string[]; // donor ids notified as replacements
}

export async function POST(req: NextRequest) {
  // Body is optional - treat empty body / missing JSON as {} (sweep all).
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
  const { sos_id } = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();

    const cutoffIso = new Date(
      Date.now() - GHOST_WINDOW_MIN * 60 * 1000
    ).toISOString();

    let query = supabase
      .from("dispatches")
      .select("*")
      .eq("status", "en_route")
      .is("started_moving_at", null)
      .lt("accepted_at", cutoffIso);

    if (sos_id) query = query.eq("sos_id", sos_id);

    const { data: staleDispatches, error: staleErr } = await query;
    if (staleErr) {
      console.error("[api/dispatch/ghost-sweep] query error:", staleErr);
      return NextResponse.json(apiError("Failed to query stale dispatches"), {
        status: 500,
      });
    }

    const ghosted: string[] = [];
    const replacement_notified: string[] = [];

    for (const d of staleDispatches ?? []) {
      // 1. Mark dispatch 'ghosted'.
      const { error: updateErr } = await supabase
        .from("dispatches")
        .update({ status: "ghosted", updated_at: new Date().toISOString() })
        .eq("id", d.id);
      if (updateErr) {
        console.error("[api/dispatch/ghost-sweep] mark ghosted failed:", updateErr);
        continue;
      }
      ghosted.push(d.id as string);

      // 2. Increment donor ghost_count.
      const { data: donorRow, error: donorErr } = await supabase
        .from("donors")
        .select("ghost_count")
        .eq("id", d.donor_id)
        .single();
      if (!donorErr && donorRow) {
        await supabase
          .from("donors")
          .update({ ghost_count: (donorRow.ghost_count as number) + 1 })
          .eq("id", d.donor_id as string);
      } else {
        console.error("[api/dispatch/ghost-sweep] donor fetch failed:", donorErr);
      }

      // 3. Deduct 10 points via rewards ledger (reason='ghosted').
      try {
        await awardPoints(supabase, {
          donor_id: d.donor_id as string,
          reason: "ghosted",
          sos_id: d.sos_id as string,
        });
      } catch (err) {
        console.error("[api/dispatch/ghost-sweep] awardPoints(ghosted) failed:", err);
      }

      // 4. Re-match the next best eligible donor for this sos_id and notify.
      try {
        const sos = await getSosOrThrow(supabase, d.sos_id as string);
        if (sos.status !== "fulfilled" && sos.status !== "cancelled") {
          const notifiedDonorId = await rematchAndNotifyNext(supabase, sos);
          if (notifiedDonorId) replacement_notified.push(notifiedDonorId);
        }
      } catch (err) {
        console.error("[api/dispatch/ghost-sweep] rematch failed (non-fatal):", err);
      }
    }

    const response: GhostSweepResponse = { ghosted, replacement_notified };
    return NextResponse.json(apiOk(response));
  } catch (err) {
    console.error("[api/dispatch/ghost-sweep] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error running ghost sweep"), {
      status: 500,
    });
  }
}
