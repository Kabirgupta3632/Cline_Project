// Demo control panel: judge/operator buttons to trigger SOS, fast-forward
// escalation, simulate donor responses, force ghost-sweep, confirm donations,
// redeem coupons, and reset demo data - this is what gets screen-recorded for
// the hackathon video. Feature: demo panel (Person 4).
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BloodGroupTag } from "@/components/ui/BloodGroupTag";
import {
  BloodGroupEnum,
  type BloodGroup,
  type DonorPublic,
  type SosRequest,
  type Urgency,
} from "@/lib/types";

const BLOOD_GROUPS = BloodGroupEnum.options;

interface SeedOptions {
  hospitals: { id: string; name: string }[];
  donors: { id: string; name: string; blood_group: string }[];
}

interface NotificationRow {
  id: string;
  donor_id: string;
  distance_km: number;
  status: "sent" | "accepted" | "declined" | "expired";
  sent_at: string;
  donor: DonorPublic | null;
}

interface DispatchRow {
  id: string;
  donor_id: string;
  status: "en_route" | "arrived" | "donated" | "cancelled" | "ghosted";
  eta_minutes: number | null;
  accepted_at: string | null;
  donor: DonorPublic | null;
}

interface SosDetail {
  sos: SosRequest;
  notifications: NotificationRow[];
  dispatches: DispatchRow[];
}

interface LogEntry {
  id: number;
  time: string;
  message: string;
  ok: boolean;
}

let logIdCounter = 0;

export default function DemoPage() {
  const [seed, setSeed] = useState<SeedOptions>({ hospitals: [], donors: [] });
  const [hospitalId, setHospitalId] = useState<string>("");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [unitsNeeded, setUnitsNeeded] = useState<number>(2);

  const [sosList, setSosList] = useState<SosRequest[]>([]);
  const [selectedSosId, setSelectedSosId] = useState<string | null>(null);
  const [sosDetail, setSosDetail] = useState<SosDetail | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const pushLog = useCallback((message: string, ok: boolean) => {
    logIdCounter += 1;
    setLog((prev) =>
      [
        {
          id: logIdCounter,
          time: new Date().toLocaleTimeString(),
          message,
          ok,
        },
        ...prev,
      ].slice(0, 60)
    );
  }, []);

  // ---- Initial load: seed options (hospitals/donors for the demo forms) ----
  useEffect(() => {
    (async () => {
      const { data, error } = await apiGet<SeedOptions>("/api/roles/seed-options");
      if (error || !data) {
        pushLog(`Failed to load seed options: ${error}`, false);
        return;
      }
      setSeed(data);
      if (data.hospitals[0]) setHospitalId(data.hospitals[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Poll SOS list every 4s so the panel stays live during the demo ----
  const refreshSosList = useCallback(async () => {
    const { data, error } = await apiGet<SosRequest[]>("/api/sos/list?limit=20");
    if (!error && data) setSosList(data);
  }, []);

  const refreshSosDetail = useCallback(async (id: string) => {
    const { data, error } = await apiGet<SosDetail>(`/api/sos/${id}`);
    if (!error && data) setSosDetail(data);
  }, []);

  useEffect(() => {
    refreshSosList();
    const interval = setInterval(refreshSosList, 4000);
    return () => clearInterval(interval);
  }, [refreshSosList]);

  useEffect(() => {
    if (!selectedSosId) {
      setSosDetail(null);
      return;
    }
    refreshSosDetail(selectedSosId);
    const interval = setInterval(() => refreshSosDetail(selectedSosId), 3000);
    return () => clearInterval(interval);
  }, [selectedSosId, refreshSosDetail]);

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  async function handleTriggerSos(urgency: Urgency) {
    if (!hospitalId) {
      pushLog("Pick a hospital first (seed options still loading?)", false);
      return;
    }
    const key = `sos-${urgency}`;
    setBusy(key);
    const { data, error } = await apiPost<{ sos: SosRequest }>("/api/sos/create", {
      hospital_id: hospitalId,
      blood_group: bloodGroup,
      units_needed: unitsNeeded,
      urgency,
      patient_note: `Demo-triggered ${urgency} request`,
    });
    if (error || !data) {
      pushLog(`/api/sos/create failed: ${error}`, false);
      setBusy(null);
      return;
    }
    pushLog(
      `🚨 ${urgency.toUpperCase()} SOS created for ${bloodGroup} (${unitsNeeded} units) - sos_id ${data.sos.id.slice(0, 8)}…`,
      true
    );
    setSelectedSosId(data.sos.id);

    if (urgency === "normal") {
      // Normal requests stay in 'inventory_check' until explicitly broadcast.
      const b = await apiPost<{ notified_donor_ids: string[] }>("/api/sos/broadcast", {
        sos_id: data.sos.id,
      });
      if (b.error) {
        pushLog(`/api/sos/broadcast failed: ${b.error}`, false);
      } else {
        pushLog(
          `📣 Broadcast sent to ${b.data?.notified_donor_ids.length ?? 0} donor(s).`,
          true
        );
      }
    }
    await refreshSosList();
    setBusy(null);
  }

  async function handleForceEscalate() {
    if (!selectedSosId) {
      pushLog("Select an SOS first to escalate it.", false);
      return;
    }
    setBusy("escalate");
    const { data, error } = await apiPost<{
      newly_notified: number;
    }>("/api/sos/escalate", { sos_id: selectedSosId });
    if (error) {
      pushLog(`/api/sos/escalate failed: ${error}`, false);
    } else {
      pushLog(
        `📡 Escalated radius - ${data?.newly_notified ?? 0} newly notified donor(s).`,
        true
      );
    }
    await refreshSosDetail(selectedSosId);
    setBusy(null);
  }

  async function handleRespond(notification: NotificationRow, response: "yes" | "no") {
    if (!selectedSosId) return;
    const key = `respond-${notification.id}`;
    setBusy(key);
    const { data, error } = await apiPost("/api/donor/respond", {
      notification_id: notification.id,
      donor_id: notification.donor_id,
      response,
    });
    if (error) {
      pushLog(`/api/donor/respond failed: ${error}`, false);
    } else {
      pushLog(
        `${response === "yes" ? "✅" : "❌"} ${notification.donor?.name ?? "Donor"} responded "${response}"`,
        true
      );
    }
    void data;
    await refreshSosDetail(selectedSosId);
    setBusy(null);
  }

  async function handleGhostSweep(scopedToSelected: boolean) {
    setBusy("ghost-sweep");
    const body = scopedToSelected && selectedSosId ? { sos_id: selectedSosId } : {};
    const { data, error } = await apiPost<{
      ghosted: string[];
      replacement_notified: string[];
    }>("/api/dispatch/ghost-sweep", body);
    if (error) {
      pushLog(`/api/dispatch/ghost-sweep failed: ${error}`, false);
    } else {
      pushLog(
        `👻 Ghost-sweep: ${data?.ghosted.length ?? 0} ghosted, ${
          data?.replacement_notified.length ?? 0
        } replacement(s) notified.`,
        true
      );
    }
    if (selectedSosId) await refreshSosDetail(selectedSosId);
    setBusy(null);
  }

  async function handleConfirmDonated(dispatch: DispatchRow) {
    if (!selectedSosId) return;
    setBusy(`donated-${dispatch.id}`);
    const { data, error } = await apiPost<{ rewards: { new_total: number } }>(
      "/api/dispatch/confirm-donated",
      { dispatch_id: dispatch.id }
    );
    if (error) {
      pushLog(`/api/dispatch/confirm-donated failed: ${error}`, false);
    } else {
      pushLog(
        `🩸 Confirmed donation for ${dispatch.donor?.name ?? "donor"} - new total ${
          data?.rewards.new_total ?? "?"
        } pts.`,
        true
      );
    }
    await refreshSosDetail(selectedSosId);
    setBusy(null);
  }

  async function handleCancelDispatch(dispatch: DispatchRow) {
    if (!selectedSosId) return;
    setBusy(`cancel-${dispatch.id}`);
    const { error } = await apiPost("/api/dispatch/cancel", {
      dispatch_id: dispatch.id,
      reason: "Demo panel manual cancel",
    });
    if (error) {
      pushLog(`/api/dispatch/cancel failed: ${error}`, false);
    } else {
      pushLog(`🚫 Cancelled dispatch for ${dispatch.donor?.name ?? "donor"}.`, true);
    }
    await refreshSosDetail(selectedSosId);
    setBusy(null);
  }

  async function handleResetDemo() {
    setBusy("reset");
    const { error } = await apiPost("/api/demo/reset", {});
    if (error) {
      pushLog(`/api/demo/reset failed: ${error}`, false);
    } else {
      pushLog("🔄 Demo data reset - all SOS/dispatch/rewards activity cleared.", true);
      setSelectedSosId(null);
      setSosDetail(null);
      await refreshSosList();
    }
    setBusy(null);
  }

  const statusColor: Record<string, string> = {
    inventory_check: "bg-yellow-100 text-yellow-800",
    broadcasting: "bg-blue-100 text-blue-800",
    fulfilled: "bg-success/10 text-success",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-raksha-700 px-6 py-5 text-white shadow-card">
        <h1 className="text-2xl font-extrabold">🎬 RakshaRakt Demo Control Panel</h1>
        <p className="text-sm text-raksha-100">
          Operator controls for the hackathon demo - trigger SOS, fast-forward
          escalation/ghost timers, simulate donor responses, and watch the
          live log below.
        </p>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-3">
        {/* ---- Left column: controls ---- */}
        <div className="space-y-6 lg:col-span-2">
          <SosTriggerCard
            seed={seed}
            hospitalId={hospitalId}
            setHospitalId={setHospitalId}
            bloodGroup={bloodGroup}
            setBloodGroup={setBloodGroup}
            unitsNeeded={unitsNeeded}
            setUnitsNeeded={setUnitsNeeded}
            busy={busy}
            onTrigger={handleTriggerSos}
          />

          <Card>
            <h2 className="mb-3 text-lg font-bold text-gray-800">
              2️⃣ Fast-Forward Timers
            </h2>
            <p className="mb-3 text-xs text-gray-400">
              Uses DEMO_ESCALATION_SECONDS / GHOST_WINDOW_MIN from .env.local
              (set low, e.g. 60s / 2min, for a fast live demo).
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                variant="primary"
                size="lg"
                disabled={busy === "escalate" || !selectedSosId}
                onClick={handleForceEscalate}
              >
                {busy === "escalate" ? "…" : "📡 Force Escalate Selected SOS"}
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={busy === "ghost-sweep"}
                onClick={() => handleGhostSweep(true)}
              >
                {busy === "ghost-sweep" ? "…" : "👻 Force Ghost Sweep"}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">
                3️⃣ Active SOS Requests
              </h2>
              <Button variant="ghost" size="sm" onClick={refreshSosList}>
                ↻ Refresh
              </Button>
            </div>
            {sosList.length === 0 ? (
              <p className="text-sm text-gray-400">
                No SOS requests yet - trigger one above.
              </p>
            ) : (
              <ul className="space-y-2">
                {sosList.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedSosId(s.id)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition ${
                        selectedSosId === s.id
                          ? "border-raksha-500 bg-raksha-50"
                          : "border-gray-200 bg-white hover:border-raksha-300"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <BloodGroupTag bloodGroup={s.blood_group} size="sm" />
                        <span>
                          {s.units_fulfilled}/{s.units_needed} fulfilled ·{" "}
                          {new Date(s.created_at).toLocaleTimeString()}
                        </span>
                      </span>
                      <span className="flex gap-2">
                        <Badge tone={s.urgency === "critical" ? "critical" : "primary"}>
                          {s.urgency.toUpperCase()}
                        </Badge>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            statusColor[s.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {s.status.replace("_", " ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {sosDetail && (
            <Card>
              <h2 className="mb-3 text-lg font-bold text-gray-800">
                4️⃣ Simulate Donor Responses — SOS {selectedSosId?.slice(0, 8)}…
              </h2>
              <p className="mb-3 text-xs text-gray-400">
                Notified donors for this SOS. Click Yes/No to simulate the
                donor&apos;s own response (calls the real
                /api/donor/respond endpoint).
              </p>
              {sosDetail.notifications.length === 0 ? (
                <p className="text-sm text-gray-400">No donors notified yet.</p>
              ) : (
                <ul className="space-y-2">
                  {sosDetail.notifications.map((n) => (
                    <li
                      key={n.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <BloodGroupTag
                          bloodGroup={n.donor?.blood_group ?? "O+"}
                          size="sm"
                        />
                        <span>
                          {n.donor?.name ?? n.donor_id.slice(0, 8)} ·{" "}
                          {n.distance_km.toFixed(1)}km ·{" "}
                          <span className="text-gray-400">{n.status}</span>
                        </span>
                      </span>
                      {n.status === "sent" ? (
                        <span className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy === `respond-${n.id}`}
                            onClick={() => handleRespond(n, "yes")}
                          >
                            ✅ Yes
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy === `respond-${n.id}`}
                            onClick={() => handleRespond(n, "no")}
                          >
                            ❌ No
                          </Button>
                        </span>
                      ) : (
                        <Badge tone={n.status === "accepted" ? "success" : "neutral"}>
                          {n.status}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mb-3 mt-5 text-sm font-bold text-gray-700">
                Dispatches
              </h3>
              {sosDetail.dispatches.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No donor en route yet - simulate a &quot;Yes&quot; above.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sosDetail.dispatches.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <BloodGroupTag
                          bloodGroup={d.donor?.blood_group ?? "O+"}
                          size="sm"
                        />
                        <span>
                          {d.donor?.name ?? d.donor_id.slice(0, 8)} ·{" "}
                          {d.eta_minutes != null
                            ? `${d.eta_minutes} min ETA`
                            : "no ETA yet"}{" "}
                          · <span className="text-gray-400">{d.status}</span>
                        </span>
                      </span>
                      {d.status === "en_route" && (
                        <span className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy === `donated-${d.id}`}
                            onClick={() => handleConfirmDonated(d)}
                          >
                            🩸 Confirm donated
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy === `cancel-${d.id}`}
                            onClick={() => handleCancelDispatch(d)}
                          >
                            🚫 Cancel
                          </Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="border-2 border-dashed border-gray-300">
            <h2 className="mb-3 text-lg font-bold text-gray-800">
              5️⃣ Reset Demo Data
            </h2>
            <p className="mb-3 text-sm text-gray-500">
              Clears all SOS requests, notifications, dispatches, rewards
              ledger, badges, and coupon redemptions, and resets every
              donor&apos;s points/donations/ghost-count back to zero. Use
              this between demo takes.
            </p>
            <Button
              variant="danger"
              size="lg"
              disabled={busy === "reset"}
              onClick={handleResetDemo}
            >
              {busy === "reset" ? "…" : "🔄 Reset Demo Data"}
            </Button>
          </Card>
        </div>

        {/* ---- Right column: live log ---- */}
        <div>
          <Card className="sticky top-6">
            <h2 className="mb-3 text-lg font-bold text-gray-800">📜 Live Log</h2>
            {log.length === 0 ? (
              <p className="text-sm text-gray-400">
                Actions you take above will appear here in real time.
              </p>
            ) : (
              <ul className="max-h-[70vh] space-y-2 overflow-y-auto text-sm">
                {log.map((entry) => (
                  <li
                    key={entry.id}
                    className={`rounded-lg border p-2 ${
                      entry.ok
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-red-200 bg-red-50 text-critical"
                    }`}
                  >
                    <span className="mr-2 font-mono text-xs text-gray-400">
                      {entry.time}
                    </span>
                    {entry.message}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

// Extracted sub-component for the "Trigger SOS" form, kept separate purely to
// keep the main page component's JSX a manageable size.
function SosTriggerCard({
  seed,
  hospitalId,
  setHospitalId,
  bloodGroup,
  setBloodGroup,
  unitsNeeded,
  setUnitsNeeded,
  busy,
  onTrigger,
}: {
  seed: SeedOptions;
  hospitalId: string;
  setHospitalId: (v: string) => void;
  bloodGroup: BloodGroup;
  setBloodGroup: (v: BloodGroup) => void;
  unitsNeeded: number;
  setUnitsNeeded: (v: number) => void;
  busy: string | null;
  onTrigger: (urgency: Urgency) => void;
}) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-bold text-gray-800">1️⃣ Trigger SOS</h2>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm text-gray-600">
          Hospital
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
          >
            {seed.hospitals.length === 0 && <option value="">(loading…)</option>}
            {seed.hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Blood group
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
            value={bloodGroup}
            onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
          >
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Units needed
          <input
            type="number"
            min={1}
            max={10}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
            value={unitsNeeded}
            onChange={(e) => setUnitsNeeded(Number(e.target.value) || 1)}
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          variant="danger"
          size="lg"
          disabled={busy === "sos-critical"}
          onClick={() => onTrigger("critical")}
        >
          {busy === "sos-critical" ? "…" : "🚨 Trigger Critical SOS"}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={busy === "sos-normal"}
          onClick={() => onTrigger("normal")}
        >
          {busy === "sos-normal" ? "…" : "📋 Trigger Normal SOS"}
        </Button>
      </div>
    </Card>
  );
}

