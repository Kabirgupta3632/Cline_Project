// POST /api/donor/snooze - donor declines and snoozes notifications for a
// period; computes donors.snooze_until. Feature: Donor API (Person 3).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, SnoozeOptionEnum } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const BodySchema = z.object({
  donor_id: z.string().min(1),
  option: SnoozeOptionEnum,
});

/** Computes the exact snooze_until timestamp (ISO string) for a given option. */
function computeSnoozeUntil(option: z.infer<typeof SnoozeOptionEnum>): Date {
  const now = new Date();
  switch (option) {
    case "1h":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "4h":
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case "24h":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "today": {
      // Today 23:59:59 local time (server local time - fine for a single-TZ demo).
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        0
      );
      return endOfDay;
    }
  }
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
  const { donor_id, option } = parsed.data;
  const snoozeUntil = computeSnoozeUntil(option);

  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("donors")
      .update({ snooze_until: snoozeUntil.toISOString() })
      .eq("id", donor_id);

    if (error) {
      console.error("[api/donor/snooze] update error:", error);
      return NextResponse.json(apiError("Failed to snooze donor"), {
        status: 500,
      });
    }

    return NextResponse.json(
      apiOk({ donor_id, snooze_until: snoozeUntil.toISOString() })
    );
  } catch (err) {
    console.error("[api/donor/snooze] unexpected error:", err);
    return NextResponse.json(apiError("Unexpected error snoozing donor"), {
      status: 500,
    });
  }
}
