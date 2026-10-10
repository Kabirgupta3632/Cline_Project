// Supabase client factory (browser + server/service-role variants) used across
// the whole app. Shared infra - belongs to no single feature, imported by all.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// NOTE: createClient() throws SYNCHRONOUSLY if given an empty URL, which would
// crash every route handler at import time before our try/catch blocks can
// run. We fall back to a harmless placeholder URL/key so the client always
// constructs successfully; any actual network call then fails as a normal
// catchable error (e.g. "fetch failed") that our route handlers already
// handle - the demo degrades gracefully instead of hard-crashing with a 500
// on every request when .env.local hasn't been filled in yet.
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-key";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || PLACEHOLDER_KEY;

/**
 * Browser-safe client using the anon key. Use this in client components
 * (e.g. subscribing to Realtime notifications) and in route handlers that
 * only need read access respecting RLS.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (SUPABASE_URL === PLACEHOLDER_URL) {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set - using placeholder (queries will fail until .env.local is configured)."
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Server-only client using the service role key - bypasses RLS. ONLY import
 * this from app/api/** route handlers (never from client components).
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (SUPABASE_URL === PLACEHOLDER_URL) {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set - using placeholder (queries will fail until .env.local is configured)."
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
