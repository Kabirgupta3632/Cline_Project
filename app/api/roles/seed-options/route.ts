// GET /api/roles/seed-options - lists seeded hospitals & donors for the
// "Login as" dropdown (no real auth system). Shared infra (Person 2).
import { NextResponse } from "next/server";
import { apiOk, apiError } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();

    const [{ data: hospitals, error: hErr }, { data: donors, error: dErr }] =
      await Promise.all([
        supabase.from("hospitals").select("id, name").order("name"),
        supabase
          .from("donors")
          .select("id, name, blood_group")
          .order("name"),
      ]);

    if (hErr || dErr) {
      console.error("[api/roles/seed-options] supabase error:", hErr ?? dErr);
      // Deterministic fallback so the role switcher still renders during the
      // demo even if Supabase credentials aren't configured yet.
      return NextResponse.json(
        apiOk({
          hospitals: [{ id: "mock-hospital-1", name: "Guwahati Medical College (mock)" }],
          donors: [
            { id: "mock-donor-1", name: "Rahul Sharma (mock)", blood_group: "O+" },
            { id: "mock-donor-2", name: "Priya Das (mock)", blood_group: "A+" },
          ],
        })
      );
    }

    return NextResponse.json(
      apiOk({ hospitals: hospitals ?? [], donors: donors ?? [] })
    );
  } catch (err) {
    console.error("[api/roles/seed-options] unexpected error:", err);
    return NextResponse.json(apiError("Failed to load seed options"), {
      status: 500,
    });
  }
}
