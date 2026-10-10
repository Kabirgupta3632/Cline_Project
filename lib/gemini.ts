// Google Gemini client wrapper: OCR of requisition slips + donor ranking text
// prompts. Belongs to the AI feature (app/api/ai/**); always has a mock fallback.
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { BloodGroup } from "./types";
import { BloodGroupEnum } from "./types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
// NOTE: pinned model names (gemini-1.5-flash, then gemini-2.5-flash) were both
// retired on the live API within the same test session on 2026-10-10 - Google
// is rapidly cycling flash model versions. Using the "-latest" alias instead
// of a pinned version avoids needing another code change every time a pinned
// model gets sunset; Google keeps this alias pointed at whatever the current
// flash model is (verified live: resolves to Gemini 3.8 Flash as of this
// writing, multimodal, supports generateContent for both vision OCR and text
// ranking).
const VISION_MODEL = "gemini-flash-latest";
const TEXT_MODEL = "gemini-flash-latest";

function getClient(): GoogleGenerativeAI | null {
  if (!GEMINI_API_KEY) return null;
  try {
    return new GoogleGenerativeAI(GEMINI_API_KEY);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Feature 1: OCR a hospital requisition slip photo -> structured fields.
// ---------------------------------------------------------------------------
export interface SlipExtraction {
  blood_group: BloodGroup | null;
  units_needed: number | null;
  patient_note: string | null;
  urgency_hint: "normal" | "critical" | null;
  raw_text: string;
  source: "gemini" | "mock";
}

const BLOOD_GROUP_REGEX = /\b(AB|A|B|O)\s?([+-]|positive|negative)\b/i;

/** Deterministic fallback used when no API key is set or the Gemini call fails. */
function mockSlipExtraction(hintText?: string): SlipExtraction {
  const text = hintText ?? "";
  let blood_group: BloodGroup | null = null;
  const match = text.match(BLOOD_GROUP_REGEX);
  if (match) {
    const letters = match[1].toUpperCase();
    const sign = /pos/i.test(match[2])
      ? "+"
      : /neg/i.test(match[2])
      ? "-"
      : match[2];
    const candidate = `${letters}${sign}`;
    const parsed = BloodGroupEnum.safeParse(candidate);
    if (parsed.success) blood_group = parsed.data;
  }
  const unitsMatch = text.match(/(\d+)\s*unit/i);
  const critical = /critical|emergency|urgent|stat\b/i.test(text);

  return {
    blood_group: blood_group ?? "O+", // safe demo default (common group)
    units_needed: unitsMatch ? parseInt(unitsMatch[1], 10) : 2,
    patient_note: text ? text.slice(0, 200) : "Mock extraction: no slip text provided.",
    urgency_hint: critical ? "critical" : "normal",
    raw_text: text || "(no OCR text - mock fallback used)",
    source: "mock",
  };
}

/**
 * Extracts blood group / units / urgency from a requisition slip image.
 * `imageBase64` should be a base64-encoded JPEG/PNG without the data: prefix.
 * Falls back to a deterministic mock if GEMINI_API_KEY is missing or the API
 * call throws, so the demo never breaks on network/quota issues.
 */
export async function extractSlipFromImage(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<SlipExtraction> {
  const client = getClient();
  if (!client) return mockSlipExtraction();

  try {
    const model = client.getGenerativeModel({ model: VISION_MODEL });
    const prompt = `You are reading a hospital blood requisition slip. Extract:
- blood_group (one of A+, A-, B+, B-, AB+, AB-, O+, O-)
- units_needed (integer)
- urgency_hint ("critical" if the slip mentions emergency/urgent/STAT/life-threatening, else "normal")
- patient_note (short free text, e.g. reason, ward, doctor)
Respond ONLY with compact JSON: {"blood_group":"...","units_needed":N,"urgency_hint":"...","patient_note":"..."}`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType } },
    ]);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return mockSlipExtraction(text);

    const parsed = JSON.parse(jsonMatch[0]);
    const groupParsed = BloodGroupEnum.safeParse(parsed.blood_group);
    return {
      blood_group: groupParsed.success ? groupParsed.data : null,
      units_needed:
        typeof parsed.units_needed === "number" ? parsed.units_needed : null,
      patient_note: parsed.patient_note ?? null,
      urgency_hint:
        parsed.urgency_hint === "critical" || parsed.urgency_hint === "normal"
          ? parsed.urgency_hint
          : null,
      raw_text: text,
      source: "gemini",
    };
  } catch (err) {
    console.error("[gemini] extractSlipFromImage failed, using mock:", err);
    return mockSlipExtraction();
  }
}

// ---------------------------------------------------------------------------
// Feature 2: Rank candidate donors using an LLM pass on top of deterministic
// distance/eligibility scoring (the DB RPC already filters eligibility; this
// just re-orders/annotates for display, e.g. "closest + most reliable first").
// ---------------------------------------------------------------------------
export interface DonorRankInput {
  donor_id: string;
  name: string;
  blood_group: BloodGroup;
  distance_km: number;
  total_donations: number;
  ghost_count: number;
}

export interface DonorRankResult {
  donor_id: string;
  score: number;
  reason: string;
}

/** Deterministic fallback ranking: closer + more reliable (fewer ghosts, more donations) first. */
function mockRankDonors(donors: DonorRankInput[]): DonorRankResult[] {
  return [...donors]
    .map((d) => {
      const reliability = d.total_donations - d.ghost_count * 2;
      const score = Math.round((100 - d.distance_km * 2 + reliability * 3) * 100) / 100;
      return {
        donor_id: d.donor_id,
        score,
        reason: `Mock score: ${d.distance_km.toFixed(1)}km away, ${d.total_donations} past donations, ${d.ghost_count} ghosts.`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Ranks donors for a given SOS using Gemini text generation, with a
 * deterministic fallback (distance + reliability heuristic) if no API key
 * is set or the call fails.
 */
export async function rankDonorsWithGemini(
  donors: DonorRankInput[],
  context: { blood_group: BloodGroup; urgency: "normal" | "critical" }
): Promise<DonorRankResult[]> {
  if (donors.length === 0) return [];
  const client = getClient();
  if (!client) return mockRankDonors(donors);

  try {
    const model = client.getGenerativeModel({ model: TEXT_MODEL });
    const prompt = `Rank these blood donors for a ${context.urgency} request needing ${context.blood_group}.
Prioritize closer distance and higher reliability (more past donations, fewer ghosts).
Donors JSON: ${JSON.stringify(donors)}
Respond ONLY with a JSON array: [{"donor_id":"...","score":0-100,"reason":"short reason"}], sorted best first.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return mockRankDonors(donors);

    const parsed = JSON.parse(jsonMatch[0]) as DonorRankResult[];
    if (!Array.isArray(parsed) || parsed.length === 0) return mockRankDonors(donors);
    return parsed;
  } catch (err) {
    console.error("[gemini] rankDonorsWithGemini failed, using mock:", err);
    return mockRankDonors(donors);
  }
}
