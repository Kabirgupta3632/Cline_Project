// SOS detail page: shows inventory mesh recommendation BEFORE broadcasting,
// lets hospital broadcast to donors, tracks dispatches/notifications with
// privacy-safe donor info, and "Confirm donated". Feature: Hospital UI (Person 2).
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api-client";
import type { SosRequest, DonorPublic, TransferRequest, DispatchStatus } from "@/lib/types";

interface SurplusHospital {
  hospital_id: string;
  name: string;
  distance_km: number;
  units_available: number;
  units_reserved: number;
  surplus_threshold: number;
}

interface NotificationRow {
  id: string;
  donor_id: string;
  distance_km: number;
  status: "sent" | "accepted" | "declined" | "expired";
  sent_at: string;
  donor: DonorPublic | null;
}

// Privacy-safe dispatch row as returned by GET /api/sos/[id] - no lat/lng.
interface DispatchRow {
  id: string;
  donor_id: string;
  status: DispatchStatus;
  eta_minutes: number | null;
  accepted_at: string | null;
  donor: DonorPublic | null;
}

export default function SosDetailPage() {
  const params = useParams<{ id: string }>();
  const sosId = params.id;

  const [sos, setSos] = useState<SosRequest | null>(null);
  const [surplus, setSurplus] = useState<SurplusHospital[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  interface SosDetailResponse {
    sos: SosRequest;
    notifications: NotificationRow[];
    dispatches: DispatchRow[];
  }

  const refresh = useCallback(async () => {
    const { data } = await apiGet<SosDetailResponse>(`/api/sos/${sosId}`);
    if (data) {
      setSos(data.sos);
      setNotifications(data.notifications);
      setDispatches(data.dispatches);
    }
    setLoading(false);
  }, [sosId]);

  useEffect(() => {
    refresh();
    // Poll every 5s so the dashboard reflects donor responses / escalation /
    // ghost-sweep replacements without needing Supabase Realtime wired here.
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Anti-ghosting rule 6: hospital dashboard also triggers ghost-sweep on an
  // interval (in addition to the manual demo-panel button) so stalled donors
  // get auto-replaced even if nobody is watching the demo panel.
  useEffect(() => {
    if (!sos || sos.status !== "broadcasting") return;
    const sweep = () => apiPost("/api/dispatch/ghost-sweep", { sos_id: sos.id });
    const interval = setInterval(sweep, 20000);
    return () => clearInterval(interval);
  }, [sos]);

  // Critical SOS auto-escalation: ping /api/sos/escalate periodically so the
  // radius widens per rule 3 without requiring a server cron.
  useEffect(() => {
    if (!sos || sos.urgency !== "critical" || sos.status !== "broadcasting") return;
    const escalate = () => apiPost("/api/sos/escalate", { sos_id: sos.id }).then(refresh);
    const interval = setInterval(escalate, 15000);
    return () => clearInterval(interval);
  }, [sos, refresh]);

  useEffect(() => {
    if (!sos) return;
    let cancelled = false;
    async function loadMesh() {
      if (!sos) return;
      const { data } = await apiPost<{ surplus_hospitals: SurplusHospital[] }>(
        "/api/inventory/mesh-check",
        { hospital_id: sos.hospital_id, blood_group: sos.blood_group, sos_id: sos.id }
      );
      if (!cancelled) setSurplus(data?.surplus_hospitals ?? []);
    }
    loadMesh();
    return () => {
      cancelled = true;
    };
  }, [sos]);

  async function handleBroadcast() {
    if (!sos) return;
    setActionErr(null);
    const { data, error } = await apiPost<{ sos: SosRequest; notified_donor_ids: string[] }>(
      "/api/sos/broadcast",
      { sos_id: sos.id }
    );
    if (error || !data) {
      setActionErr(error ?? "Broadcast failed");
      return;
    }
    setSos(data.sos);
    setActionMsg(`Broadcast sent to ${data.notified_donor_ids.length} donor(s).`);
  }

  async function handleRequestTransfer(fromHospitalId: string) {
    if (!sos) return;
    setActionErr(null);
    const { data, error } = await apiPost<TransferRequest>(
      "/api/inventory/transfer-request",
      {
        sos_id: sos.id,
        from_hospital_id: fromHospitalId,
        to_hospital_id: sos.hospital_id,
        blood_group: sos.blood_group,
        units: sos.units_needed,
      }
    );
    if (error || !data) {
      setActionErr(error ?? "Transfer request failed");
      return;
    }
    setActionMsg("Inter-hospital transfer requested.");
  }

  async function handleConfirmDonated(dispatchId: string) {
    setActionErr(null);
    const { error } = await apiPost<DispatchRow>("/api/dispatch/confirm-donated", {
      dispatch_id: dispatchId,
    });
    if (error) {
      setActionErr(error);
      return;
    }
    setActionMsg("Donation confirmed — rewards issued.");
    refresh();
  }

  if (loading) {
    return <main className="min-h-screen bg-gray-50 px-6 py-8 text-gray-400">Loading…</main>;
  }

  if (!sos) {
    return (
      <main className="min-h-screen bg-gray-50 px-6 py-8">
        <p className="text-critical">SOS not found.</p>
      </main>
    );
  }

  return (
    <SosDetailBody
      sos={sos}
      surplus={surplus}
      notifications={notifications}
      dispatches={dispatches}
      actionMsg={actionMsg}
      actionErr={actionErr}
      onBroadcast={handleBroadcast}
      onRequestTransfer={handleRequestTransfer}
      onConfirmDonated={handleConfirmDonated}
    />
  );
}

// ---------------------------------------------------------------------------
// Presentational body - kept separate so the data-fetching component above
// stays readable. Not exported; only used within this page module.
// ---------------------------------------------------------------------------
function SosDetailBody({
  sos,
  surplus,
  notifications,
  dispatches,
  actionMsg,
  actionErr,
  onBroadcast,
  onRequestTransfer,
  onConfirmDonated,
}: {
  sos: SosRequest;
  surplus: SurplusHospital[];
  notifications: NotificationRow[];
  dispatches: DispatchRow[];
  actionMsg: string | null;
  actionErr: string | null;
  onBroadcast: () => void;
  onRequestTransfer: (fromHospitalId: string) => void;
  onConfirmDonated: (dispatchId: string) => void;
}) {
  const canBroadcast = sos.status === "inventory_check";

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-card border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-raksha-700">
                {sos.blood_group} · {sos.units_needed} unit(s)
              </h1>
              <p className="text-sm text-gray-500">
                {sos.units_fulfilled}/{sos.units_needed} fulfilled · radius{" "}
                {sos.radius_km}km
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                sos.urgency === "critical"
                  ? "bg-critical text-white"
                  : "bg-raksha-100 text-raksha-700"
              }`}
            >
              {sos.urgency.toUpperCase()}
            </span>
          </div>
          {sos.patient_note && (
            <p className="mt-3 text-sm text-gray-600 border-t pt-3">
              📝 {sos.patient_note}
            </p>
          )}
        </div>

        {(actionMsg || actionErr) && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              actionErr
                ? "bg-red-50 text-critical border border-red-200"
                : "bg-green-50 text-success border border-green-200"
            }`}
          >
            {actionErr ?? actionMsg}
          </div>
        )}

        {/* Inventory Mesh recommendation - rule 4: shown BEFORE broadcast */}
        {surplus.length > 0 && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
            <h2 className="font-semibold text-amber-800 mb-2">
              💡 Inventory Mesh: nearby surplus found
            </h2>
            <p className="text-sm text-amber-700 mb-3">
              These hospitals have surplus {sos.blood_group} stock within 15km.
              Consider an inter-hospital transfer before — or alongside —
              broadcasting to the public.
            </p>
            <ul className="space-y-2">
              {surplus.map((h) => (
                <li
                  key={h.hospital_id}
                  className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-card"
                >
                  <div>
                    <p className="font-medium text-gray-800">{h.name}</p>
                    <p className="text-xs text-gray-500">
                      {h.distance_km.toFixed(1)}km away · {h.units_available - h.units_reserved} spare units
                    </p>
                  </div>
                  <button
                    onClick={() => onRequestTransfer(h.hospital_id)}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    Request Transfer
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl bg-white p-5 shadow-card border border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Donor Broadcast</h2>
            {canBroadcast && (
              <button
                onClick={onBroadcast}
                className="rounded-lg bg-raksha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-raksha-700"
              >
                {surplus.length > 0 ? "Broadcast to donors anyway" : "📢 Broadcast Now"}
              </button>
            )}
          </div>
          {!canBroadcast && (
            <p className="mt-2 text-xs text-gray-400">
              Status: {sos.status.replace("_", " ")}
            </p>
          )}
        </div>

        <NotificationsList notifications={notifications} />
        <DispatchesList dispatches={dispatches} onConfirmDonated={onConfirmDonated} />
      </div>
    </main>
  );
}

function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  if (notifications.length === 0) return null;
  const statusColor: Record<string, string> = {
    sent: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-success",
    declined: "bg-gray-100 text-gray-500",
    expired: "bg-gray-100 text-gray-400",
  };
  return (
    <div className="rounded-xl bg-white p-5 shadow-card border border-gray-200">
      <h2 className="font-semibold text-gray-800 mb-3">
        Donors Notified ({notifications.length})
      </h2>
      <ul className="divide-y">
        {notifications.map((n) => (
          <li key={n.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {n.donor?.name ?? "Unknown donor"} ({n.donor?.blood_group})
              </p>
              {/* Privacy rule 9: distance_km is fine to show, never raw lat/lng */}
              <p className="text-xs text-gray-400">{n.distance_km.toFixed(1)}km away</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor[n.status]}`}>
              {n.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DispatchesList({
  dispatches,
  onConfirmDonated,
}: {
  dispatches: DispatchRow[];
  onConfirmDonated: (dispatchId: string) => void;
}) {
  if (dispatches.length === 0) return null;
  const statusColor: Record<string, string> = {
    en_route: "bg-blue-100 text-blue-700",
    arrived: "bg-amber-100 text-amber-700",
    donated: "bg-green-100 text-success",
    cancelled: "bg-gray-100 text-gray-500",
    ghosted: "bg-red-100 text-critical",
  };
  return (
    <div className="rounded-xl bg-white p-5 shadow-card border border-gray-200">
      <h2 className="font-semibold text-gray-800 mb-3">
        En Route Donors ({dispatches.length})
      </h2>
      <ul className="divide-y">
        {dispatches.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {d.donor?.name ?? "Unknown donor"} ({d.donor?.blood_group})
              </p>
              <p className="text-xs text-gray-400">
                ETA: {d.eta_minutes != null ? `${d.eta_minutes} min` : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusColor[d.status]}`}>
                {d.status.replace("_", " ")}
              </span>
              {(d.status === "en_route" || d.status === "arrived") && (
                <button
                  onClick={() => onConfirmDonated(d.id)}
                  className="rounded-lg bg-success px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  ✅ Confirm donated
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
