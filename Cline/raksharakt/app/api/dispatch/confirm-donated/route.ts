// POST /api/dispatch/confirm-donated - hospital taps "Confirm donated": marks
// dispatch 'donated', bumps donor stats + sos.units_fulfilled, awards reward
// points/badges. Feature: dispatch + rewards (Person 4).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, type Dispatch, type SosRequest } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { awardPoints, type AwardPointsResult } from "@/app/api/rewards/_lib/award";

const BodySchema = z.object({
  dispatch_id: z.string().uuid("dispatch_id must be a UUID"),
});

export interface ConfirmDonatedResponse {
  dispatch: Dispatch;
  sos: SosRequest | null;
  rewards: AwardPointsResult;
  bonus_rewards: AwardPointsResult | null;
}

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

    const { data: existing, error: fetchErr } = await supabase
      .from("dispatches")
      .select("*")
      .eq("id", dispatch_id)
      .maybeSingle();

    if (fetchErr) {
      console.error("[api/dispatch/confirm-donated] fetch error:", fetchErr);
      return NextResponse.json(apiError("Failed to load dispatch"), {
        status: 500,
      });
    }
    if (!existing) {
      return NextResponse.json(apiError("Dispatch not found"), { status: 404 });
    }

    const { data: updatedDispatch, error: updateErr } = await supabase
      .from("dispatches")
      .update({ status: "donated", updated_at: new Date().toISOString() })
      .eq("id", dispatch_id)
      .select("*")
      .single();

    if (updateErr || !updatedDispatch) {
      console.error("[api/dispatch/confirm-donated] update error:", updateErr);
      return NextResponse.json(apiError("Failed to confirm donation"), {
        status: 500,
      });
    }
    const dispatch = updatedDispatch as Dispatch;

    // Bump donor stats: total_donations += 1, last_donated_at = now().
    const { data: donorRow, error: donorErr } = await supabase
      .from("donors")
      .select("total_donations")
      .eq("id", dispatch.donor_id)
      .single();

    if (!donorErr && donorRow) {
      await supabase
        .from("donors")
        .update({
          total_donations: (donorRow.total_donations as number) + 1,
          last_donated_at: new Date().toISOString(),
        })
        .eq("id", dispatch.donor_id);
    } else {
      console.error("[api/dispatch/confirm-donated] donor fetch error:", donorErr);
    }

    // Bump sos_requests.units_fulfilled; flip to 'fulfilled' if met/exceeded.
    let sos: SosRequest | null = null;
    const { data: sosRow, error: sosFetchErr } = await supabase
      .from("sos_requests")
      .select("*")
      .eq("id", dispatch.sos_id)
      .maybeSingle();

    if (!sosFetchErr && sosRow) {
      const units_fulfilled = (sosRow.units_fulfilled as number) + 1;
      const newStatus =
        units_fulfilled >= (sosRow.units_needed as number) ? "fulfilled" : sosRow.status;
      const { data: updatedSos, error: sosUpdateErr } = await supabase
        .from("sos_requests")
        .update({ units_fulfilled, status: newStatus })
        .eq("id", dispatch.sos_id)
        .select("*")
        .single();
      if (!sosUpdateErr && updatedSos) {
        sos = updatedSos as SosRequest;
      }
    } else {
      console.error("[api/dispatch/confirm-donated] sos fetch error:", sosFetchErr);
    }

    // Rewards: +50 for the confirmed donation, badge-check runs inside.
    const rewards = await awardPoints(supabase, {
      donor_id: dispatch.donor_id,
      reason: "donation_confirmed",
      sos_id: dispatch.sos_id,
    });

    // +25 extra if the SOS was critical.
    let bonus_rewards: AwardPointsResult | null = null;
    if (sos?.urgency === "critical") {
      bonus_rewards = await awardPoints(supabase, {
        donor_id: dispatch.donor_id,
        reason: "critical_bonus",
        sos_id: dispatch.sos_id,
      });
    }

    const response: ConfirmDonatedResponse = { dispatch, sos, rewards, bonus_rewards };
    return NextResponse.json(apiOk(response));
  } catch (err) {
    console.error("[api/dispatch/confirm-donated] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error confirming donation"), {
      status: 500,
    });
  }
}
