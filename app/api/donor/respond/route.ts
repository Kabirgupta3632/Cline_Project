// POST /api/donor/respond - donor says yes/no to an SOS notification; yes
// upserts a dispatches row (en_route). Feature: Donor API (Person 3).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import type { SosNotification, Dispatch } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const BodySchema = z.object({
  notification_id: z.string().min(1),
  donor_id: z.string().min(1),
  response: z.enum(["yes", "no"]),
});

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
  const { notification_id, donor_id, response } = parsed.data;

  try {
    const supabase = getSupabaseServiceClient();

    // Load the notification first so we know which sos_id it belongs to and
    // can validate the donor_id matches (defensive - no real auth here).
    const { data: notifRow, error: fetchErr } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notification_id)
      .maybeSingle();

    if (fetchErr) {
      console.error("[api/donor/respond] fetch notification error:", fetchErr);
      return NextResponse.json(apiError("Failed to load notification"), {
        status: 500,
      });
    }
    if (!notifRow) {
      return NextResponse.json(apiError("Notification not found"), {
        status: 404,
      });
    }
    if (notifRow.donor_id !== donor_id) {
      return NextResponse.json(
        apiError("Notification does not belong to this donor"),
        { status: 403 }
      );
    }

    const newStatus = response === "yes" ? "accepted" : "declined";
    const { data: updatedNotif, error: updateErr } = await supabase
      .from("notifications")
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq("id", notification_id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[api/donor/respond] update notification error:", updateErr);
      return NextResponse.json(apiError("Failed to update notification"), {
        status: 500,
      });
    }

    let dispatch: Dispatch | null = null;

    if (response === "yes") {
      // Upsert on (sos_id, donor_id) in case this donor is re-notified for
      // the same SOS (e.g. after a prior decline or ghost-sweep retry).
      const { data: existingDispatch, error: existingErr } = await supabase
        .from("dispatches")
        .select("*")
        .eq("sos_id", notifRow.sos_id)
        .eq("donor_id", donor_id)
        .maybeSingle();

      if (existingErr) {
        console.error("[api/donor/respond] lookup dispatch error:", existingErr);
        return NextResponse.json(apiError("Failed to check existing dispatch"), {
          status: 500,
        });
      }

      if (existingDispatch) {
        const { data: updatedDispatch, error: dErr } = await supabase
          .from("dispatches")
          .update({
            status: "en_route",
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingDispatch.id)
          .select("*")
          .single();
        if (dErr) {
          console.error("[api/donor/respond] update dispatch error:", dErr);
          return NextResponse.json(apiError("Failed to update dispatch"), {
            status: 500,
          });
        }
        dispatch = updatedDispatch as Dispatch;
      } else {
        const { data: newDispatch, error: dErr } = await supabase
          .from("dispatches")
          .insert({
            sos_id: notifRow.sos_id,
            donor_id,
            status: "en_route",
            accepted_at: new Date().toISOString(),
          })
          .select("*")
          .single();
        if (dErr) {
          console.error("[api/donor/respond] insert dispatch error:", dErr);
          return NextResponse.json(apiError("Failed to create dispatch"), {
            status: 500,
          });
        }
        dispatch = newDispatch as Dispatch;
      }
    }

    return NextResponse.json(
      apiOk({ notification: updatedNotif as SosNotification, dispatch })
    );
  } catch (err) {
    console.error("[api/donor/respond] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error responding to SOS"), {
      status: 500,
    });
  }
}
