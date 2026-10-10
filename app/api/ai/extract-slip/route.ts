// POST /api/ai/extract-slip - OCRs a hospital requisition slip photo into
// structured fields (blood group, units, urgency). Feature: AI (Person 2).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiOk, apiError } from "@/lib/types";
import { extractSlipFromImage } from "@/lib/gemini";

// Request body: base64 image data (no data: prefix) + its mime type.
const BodySchema = z.object({
  image_base64: z.string().min(1, "image_base64 is required"),
  mime_type: z.string().default("image/jpeg"),
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
    const extraction = await extractSlipFromImage(
      parsed.data.image_base64,
      parsed.data.mime_type
    );
    // extractSlipFromImage never throws (it has its own internal mock
    // fallback), so by the time we get here we always have a usable result.
    return NextResponse.json(apiOk(extraction));
  } catch (err) {
    // Defensive: should be unreachable given the fallback inside lib/gemini.ts,
    // but we never want this endpoint to break the demo.
    console.error("[api/ai/extract-slip] unexpected error:", err);
    return NextResponse.json(apiError("Slip extraction failed unexpectedly"), {
      status: 500,
    });
  }
}
