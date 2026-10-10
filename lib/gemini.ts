// Google Gemini API wrapper with deterministic fallback
// Feature: AI – used by /api/ai/extract-slip and /api/ai/rank-donors

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { BloodGroup, SlipExtraction, Urgency } from './types';

const MODEL_ID = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

// ─── Slip Extraction ─────────────────────────────────────────────────────────

const SLIP_PROMPT = `
You are a medical requisition parser for an emergency blood bank system.
Extract the following fields from the blood requisition slip text or image:
- blood_group: one of A+, A-, B+, B-, AB+, AB-, O+, O- (null if not found)
- units: integer number of units needed (null if not found)
- urgency: "critical" if the slip says urgent/critical/emergency, else "normal"
- hospital_name: name of the requesting hospital (null if not found)
- patient_note: brief clinical note or reason (null if not found)
- confidence: float 0-1 representing your confidence in the extraction

Respond with valid JSON only, no markdown fences.
`;

/**
 * Extracts blood requisition info from a base64 image or plain text.
 * Falls back to a mock response if GEMINI_API_KEY is not set or the call fails.
 */
export async function extractSlip(
  input: { base64Image?: string; mimeType?: string; text?: string },
): Promise<SlipExtraction> {
  const client = getClient();

  if (client) {
    try {
      const model = client.getGenerativeModel({ model: MODEL_ID });
      const parts: Parameters<typeof model.generateContent>[0] extends { contents: infer C } ? never : any[] = [];

      if (input.base64Image && input.mimeType) {
        const contents: any = [
          { text: SLIP_PROMPT },
          {
            inlineData: {
              mimeType: input.mimeType,
              data: input.base64Image,
            },
          },
        ];
        const result = await model.generateContent(contents);
        const text = result.response.text().trim();
        return JSON.parse(text) as SlipExtraction;
      } else if (input.text) {
        const result = await model.generateContent(SLIP_PROMPT + '\n\nSlip text:\n' + input.text);
        const text = result.response.text().trim();
        return JSON.parse(text) as SlipExtraction;
      }
    } catch (err) {
      console.error('[gemini] extractSlip failed, using fallback:', err);
    }
  }

  // ── Deterministic fallback ──
  return mockExtractSlip(input.text ?? '');
}

function mockExtractSlip(text: string): SlipExtraction {
  const lower = text.toLowerCase();
  const bloodGroups: BloodGroup[] = ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'];
  const found = bloodGroups.find((g) => text.includes(g)) ?? null;
  const unitsMatch = text.match(/(\d+)\s*(unit|pint|bag)/i);
  const urgency: Urgency =
    lower.includes('urgent') || lower.includes('critical') || lower.includes('emergency')
      ? 'critical'
      : 'normal';
  return {
    blood_group: found,
    units: unitsMatch ? parseInt(unitsMatch[1], 10) : 2,
    urgency,
    hospital_name: null,
    patient_note: text.slice(0, 120) || null,
    confidence: found ? 0.75 : 0.3,
  };
}

// ─── Donor Ranking ───────────────────────────────────────────────────────────

export interface DonorRankInput {
  donor_id: string;
  blood_group: BloodGroup;
  distance_km: number;
  last_donated_at: string | null;
  total_donations: number;
  ghost_count: number;
}

export interface DonorRankResult {
  donor_id: string;
  score: number;
  reason: string;
}

const RANK_PROMPT = (donors: DonorRankInput[], neededGroup: BloodGroup) => `
You are ranking blood donors for an emergency SOS request needing ${neededGroup}.
Score each donor 0-100 based on: distance (closer = better), recency of last donation,
total donations (experience), and ghost history (fewer ghosts = better).
Return a JSON array: [{donor_id, score, reason}] sorted by score descending.
Donors: ${JSON.stringify(donors)}
Respond with valid JSON only.
`;

/**
 * Ranks donors using Gemini. Falls back to a deterministic scoring formula.
 */
export async function rankDonors(
  donors: DonorRankInput[],
  neededGroup: BloodGroup,
): Promise<DonorRankResult[]> {
  const client = getClient();

  if (client && donors.length > 0) {
    try {
      const model = client.getGenerativeModel({ model: MODEL_ID });
      const result = await model.generateContent(RANK_PROMPT(donors, neededGroup));
      const text = result.response.text().trim();
      return JSON.parse(text) as DonorRankResult[];
    } catch (err) {
      console.error('[gemini] rankDonors failed, using fallback:', err);
    }
  }

  return deterministicRank(donors, neededGroup);
}

function deterministicRank(
  donors: DonorRankInput[],
  neededGroup: BloodGroup,
): DonorRankResult[] {
  return donors
    .map((d) => {
      // Distance score: 0 km = 40 pts, 50 km = 0 pts
      const distScore = Math.max(0, 40 - d.distance_km * 0.8);
      // Exact match bonus
      const matchBonus = d.blood_group === neededGroup ? 20 : 0;
      // Experience score (capped at 20)
      const expScore = Math.min(20, d.total_donations * 4);
      // Ghost penalty
      const ghostPenalty = d.ghost_count * 5;
      const score = Math.max(0, distScore + matchBonus + expScore - ghostPenalty);
      return {
        donor_id: d.donor_id,
        score: Math.round(score),
        reason: `dist=${d.distance_km.toFixed(1)}km match=${matchBonus > 0} donations=${d.total_donations}`,
      };
    })
    .sort((a, b) => b.score - a.score);
}
