// POST /api/demo/reset - wipes all demo-generated activity (SOS requests,
// notifications, dispatches, rewards ledger, badges, coupon redemptions,
// dispatch events) and resets donor stats back to a pristine state, so judges 
// can re-run the demo from scratch. Feature: demo panel (Person 4).
import { NextResponse } from "next/server";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function POST() {
  try {
    const supabase = getSupabaseServiceClient();

    // The user might not have run dispatch_events.sql yet, so trying to delete
    // from it might crash the whole reset for them. Let's make it optional.
    try {
      await supabase.from("dispatch_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } catch(e) {}

    // sos_requests cascades to notifications + dispatches + dispatch_events via FK ON DELETE
    // CASCADE (see db/schema.sql and db/dispatch_events.sql), so deleting all sos_requests 
    // clears those too. rewards_ledger/badges/coupon_redemptions are cleared explicitly.
    const results = await Promise.all([
      supabase.from("sos_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("rewards_ledger").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("badges").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase
        .from("coupon_redemptions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase
        .from("transfer_requests")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
    ]);

    // ignore table doesn't exist error in case they missed the sql file
    const failed = results.find((r) => r.error && !r.error.message.includes("does not exist"));
    if (failed?.error) {
      console.error("[api/demo/reset] delete step failed:", failed.error);
      return NextResponse.json(apiError(`Failed to clear demo activity tables: ${failed.error.message}`), {
        status: 500,
      });
    }

    const { error: donorResetErr } = await supabase
      .from("donors")
      .update({
        hero_points: 0,
        total_donations: 0,
        ghost_count: 0,
        last_donated_at: null,
        snooze_until: null,
        is_available: true,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (donorResetErr && !donorResetErr.message.includes("does not exist")) {
      console.error("[api/demo/reset] donor reset failed:", donorResetErr);
      return NextResponse.json(apiError("Failed to reset donor stats"), {
        status: 500,
      });
    }

    return NextResponse.json(apiOk({ reset: true }));
  } catch (err: any) {
    console.error("[api/demo/reset] unexpected error:", err);
    return NextResponse.json(apiError(`Unexpected error resetting demo data: ${err.message}`), {
      status: 500,
    });
  }
}
