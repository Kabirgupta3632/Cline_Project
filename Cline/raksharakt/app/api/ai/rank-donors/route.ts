// POST /api/ai/rank-donors - re-ranks a candidate donor list for an SOS using
// Gemini (distance + reliability aware), with a deterministic fallback.
// Feature: AI (Person 2).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError, BloodGroupEnum, UrgencyEnum } from "@/lib/types";
import { rankDonorsWithGemini } from "@/lib/gemini";

const DonorInputSchema = z.object({
  donor_id: z.string().min(1),
  name: z.string().min(1),
  blood_group: BloodGroupEnum,
  distance_km: z.number().nonnegative(),
  total_donations: z.number().int().nonnegative(),
  ghost_count: z.number().int().nonnegative(),
});

const BodySchema = z.object({
  sos_id: z.string().min(1).optional(),
  blood_group: BloodGroupEnum,
  urgency: UrgencyEnum,
  donors: z.array(DonorInputSchema).min(1, "At least one donor is required"),
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

  try {
    const ranked = await rankDonorsWithGemini(parsed.data.donors, {
      blood_group: parsed.data.blood_group,
      urgency: parsed.data.urgency,
    });
    return NextResponse.json(apiOk(ranked));
  } catch (err) {
    console.error("[api/ai/rank-donors] unexpected error:", err);
    return NextResponse.json(apiError("Donor ranking failed unexpectedly"), {
      status: 500,
    });
  }
}
