// POST /api/sos/create - creates a new SOS blood request, starting in
// 'inventory_check' status, and runs the Inventory Mesh check before any
// public donor broadcast. Feature: sos (Person 1).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiOk,
  apiError,
  BloodGroupEnum,
  UrgencyEnum,
  type SosRequest,
  type TransferRequest,
} from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { NORMAL_RADIUS_KM, CRITICAL_START_RADIUS_KM } from "@/lib/geo";
import { findSurplusHospitals, type SurplusHospitalRow } from "@/app/api/inventory/_lib/mesh";
import {
  findEligibleDonors,
  insertNotifications,
  assertHospitalVerified,
} from "@/lib/matching";

const BodySchema = z.object({
  hospital_id: z.string().uuid("hospital_id must be a UUID"),
  blood_group: BloodGroupEnum,
  units_needed: z.number().int().positive().default(1),
  urgency: UrgencyEnum.default("normal"),
  patient_note: z.string().max(500).nullable().optional(),
  raw_slip_text: z.string().nullable().optional(),
});

export interface SosCreateResponse {
  sos: SosRequest;
  mesh_recommendation: SurplusHospitalRow[];
  auto_transfer_request: TransferRequest | null;
  broadcast: { notified_donor_ids: string[] } | null;
  // Rule 7 (anti-misuse): true when the critical auto-broadcast was skipped
  // because the requesting hospital isn't verified yet. The transfer request
  // (inter-hospital, not civilian-facing) still proceeds normally either way.
  broadcast_blocked_unverified?: boolean;
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
  const body = parsed.data;

  const supabase = getSupabaseServiceClient();

  try {
    const radius_km =
      body.urgency === "critical" ? CRITICAL_START_RADIUS_KM : NORMAL_RADIUS_KM;

    const { data: sosRow, error: insertErr } = await supabase
      .from("sos_requests")
      .insert({
        hospital_id: body.hospital_id,
        blood_group: body.blood_group,
        units_needed: body.units_needed,
        urgency: body.urgency,
        status: "inventory_check",
        radius_km,
        patient_note: body.patient_note ?? null,
        raw_slip_text: body.raw_slip_text ?? null,
      })
      .select("*")
      .single();

    if (insertErr || !sosRow) {
      console.error("[api/sos/create] insert failed:", insertErr);
      return NextResponse.json(apiError("Failed to create SOS request"), {
        status: 500,
      });
    }
    const sos = sosRow as SosRequest;

    // ---- Inventory Mesh rule (rule 4): check for surplus BEFORE broadcast ----
    let mesh_recommendation: SurplusHospitalRow[] = [];
    try {
      mesh_recommendation = await findSurplusHospitals(supabase, {
        hospitalId: sos.hospital_id,
        bloodGroup: sos.blood_group,
        radiusKm: 15,
      });
    } catch (err) {
      // Mesh check is a nice-to-have recommendation - never block SOS creation.
      console.error("[api/sos/create] mesh check failed (non-fatal):", err);
    }

    let auto_transfer_request: TransferRequest | null = null;
    let broadcast: { notified_donor_ids: string[] } | null = null;
    let broadcast_blocked_unverified = false;

    if (sos.urgency === "critical") {
      // Rule 7 (anti-misuse / hospital verification gate): the critical
      // auto-broadcast-to-donors path requires hospitals.verified = true.
      // The transfer-request side (inter-hospital, never civilian-facing)
      // is NOT gated by this check - unverified hospitals can still ask
      // neighbouring hospitals for surplus stock.
      let hospitalVerified = true;
      try {
        await assertHospitalVerified(supabase, sos.hospital_id);
      } catch (err) {
        hospitalVerified = false;
        console.warn(
          "[api/sos/create] critical auto-broadcast skipped (hospital_not_verified):",
          err instanceof Error ? err.message : err
        );
      }

      // CRITICAL: do a transfer request (if surplus exists) AND broadcast to
      // donors in parallel - we never wait on inter-hospital negotiation when
      // life is at risk.
      const top = mesh_recommendation[0] ?? null;
      const transferPromise: Promise<TransferRequest | null> = top
        ? (async () => {
            const units = Math.max(
              1,
              Math.min(sos.units_needed, top.units_available - top.units_reserved)
            );
            const { data, error } = await supabase
              .from("transfer_requests")
              .insert({
                sos_id: sos.id,
                from_hospital_id: top.hospital_id,
                to_hospital_id: sos.hospital_id,
                blood_group: sos.blood_group,
                units,
                status: "requested",
              })
              .select("*")
              .single();
            if (error || !data) {
              console.error(
                "[api/sos/create] auto transfer_request insert failed:",
                error
              );
              return null;
            }
            return data as TransferRequest;
          })()
        : Promise.resolve(null);

      const broadcastPromise: Promise<{ notified_donor_ids: string[] }> =
        hospitalVerified
          ? (async () => {
              const donors = await findEligibleDonors(supabase, {
                sosId: sos.id,
                hospitalId: sos.hospital_id,
                bloodGroup: sos.blood_group,
                urgency: sos.urgency,
                radiusKm: sos.radius_km,
              });
              const notified = await insertNotifications(supabase, sos.id, donors);
              return { notified_donor_ids: notified };
            })()
          : Promise.resolve({ notified_donor_ids: [] });

      broadcast_blocked_unverified = !hospitalVerified;

      [auto_transfer_request, broadcast] = await Promise.all([
        transferPromise,
        broadcastPromise,
      ]);

      // Only flip to 'broadcasting' if we actually notified donors - an
      // unverified hospital's SOS stays 'inventory_check' so the dashboard
      // correctly reflects that civilians were never alerted (the transfer
      // request, if any, can still proceed independently).
      if (hospitalVerified) {
        const { data: updatedSos, error: updateErr } = await supabase
          .from("sos_requests")
          .update({ status: "broadcasting" })
          .eq("id", sos.id)
          .select("*")
          .single();
        if (!updateErr && updatedSos) {
          Object.assign(sos, updatedSos);
        }
      }
    }
    // NORMAL urgency: status stays 'inventory_check'. The hospital sees
    // mesh_recommendation (if any) and decides whether to request a transfer
    // via /api/inventory/transfer-request, or call /api/sos/broadcast to
    // alert public donors directly.

    const response: SosCreateResponse = {
      sos,
      mesh_recommendation,
      auto_transfer_request,
      broadcast,
      broadcast_blocked_unverified,
    };
    return NextResponse.json(apiOk(response), { status: 201 });
  } catch (err) {
    console.error("[api/sos/create] unexpected error:", err);
    return NextResponse.json(apiError("Failed to create SOS request"), {
      status: 500,
    });
  }
}
