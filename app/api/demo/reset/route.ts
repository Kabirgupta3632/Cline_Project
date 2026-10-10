// POST /api/demo/reset - wipes all demo-generated activity (SOS requests,
// notifications, dispatches, rewards ledger, badges, coupon redemptions,
// dispatch events) and resets donor stats back to a pristine state, so judges 
// can re-run the demo from scratch. Feature: demo panel (Person 4).
import { NextResponse } from "next/server";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// Tables to wipe, in order. sos_requests cascades to notifications +
// dispatches + dispatch_events via FK ON DELETE CASCADE (db/schema.sql,
// db/dispatch_events.sql); the rest are cleared explicitly. dispatch_events is
// listed first and tolerated-if-missing in case someone hasn't run that
// migration yet.
const ACTIVITY_TABLES = [
  "dispatch_events",
  "sos_requests",
  "rewards_ledger",
  "badges",
  "coupon_redemptions",
  "transfer_requests",
] as const;

// Transient network failures (undici "fetch failed", ECONNRESET, timeouts)
// are retried a few times with a short backoff. On a flaky hotel/venue wifi a
// single dropped socket used to fail the whole reset right before a demo.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.message} ${(err.cause as Error | undefined)?.message ?? ""}` : String(err);
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(msg);
}

// The builder returned by supabase-js is a thenable, not a Promise subclass,
// so T must be inferred from fn's return instead of a Promise<T> constraint.
async function withRetry<T>(label: string, fn: () => T): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === MAX_ATTEMPTS) throw err;
      console.warn(`[api/demo/reset] ${label} attempt ${attempt} failed (transient), retrying...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw lastErr;
}

export async function POST() {
  try {
    const supabase = getSupabaseServiceClient();

    // Sequential (not Promise.all) on purpose: 6 concurrent sockets on a weak
    // connection is exactly what triggered "fetch failed"; serial is ~1s total.
    for (const table of ACTIVITY_TABLES) {
      const { error } = await withRetry(`delete ${table}`, () =>
        supabase.from(table).delete().neq("id", NIL_UUID)
      );
      // Tolerate a missing table (someone skipped an optional .sql file).
      if (error && !error.message.includes("does not exist")) {
        console.error(`[api/demo/reset] delete ${table} failed:`, error);
        return NextResponse.json(
          apiError(`Failed to clear demo activity tables: ${table}: ${error.message}`),
          { status: 500 }
        );
      }
    }

    const { error: donorResetErr } = await withRetry("reset donor stats", () =>
      supabase
        .from("donors")
        .update({
          hero_points: 0,
          total_donations: 0,
          ghost_count: 0,
          last_donated_at: null,
          snooze_until: null,
          is_available: true,
        })
        .neq("id", NIL_UUID)
    );

    if (donorResetErr && !donorResetErr.message.includes("does not exist")) {
      console.error("[api/demo/reset] donor reset failed:", donorResetErr);
      return NextResponse.json(apiError("Failed to reset donor stats"), {
        status: 500,
      });
    }

    return NextResponse.json(apiOk({ reset: true }));
  } catch (err) {
    console.error("[api/demo/reset] unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(apiError(`Unexpected error resetting demo data: ${message}`), {
      status: 500,
    });
  }
}
