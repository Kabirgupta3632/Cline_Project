// En-route screen: live ETA + periodic "share my location" ping (every 12s)
// via navigator.geolocation, with a simulated-movement fallback so the demo
// never breaks. Feature: Donor UI (Person 3).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api-client";
import { getActiveDonorId } from "../../donor-session";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Dispatch, DispatchStatus } from "@/lib/types";

const PING_INTERVAL_MS = 12000;

// Fallback "walk toward hospital-ish" simulated movement used when
// geolocation permission is denied/unavailable - keeps the ETA/location demo
// flowing. Small deterministic jitter around a starting point, nudging
// slightly each tick so haversine distance keeps changing (triggers the
// anti-ghost "moved" check too).
function nextSimulatedPosition(prev: { lat: number; lng: number } | null) {
  const base = prev ?? { lat: 26.1445, lng: 91.7362 };
  return {
    lat: base.lat + (Math.random() - 0.3) * 0.002,
    lng: base.lng + (Math.random() - 0.3) * 0.002,
  };
}

const STATUS_TONE: Record<DispatchStatus, "info" | "warning" | "success" | "neutral" | "critical"> = {
  en_route: "info",
  arrived: "warning",
  donated: "success",
  cancelled: "neutral",
  ghosted: "critical",
};

export default function EnRoutePage() {
  const params = useParams<{ dispatchId: string }>();
  const router = useRouter();
  const dispatchId = params.dispatchId;

  const [donorId, setDonorId] = useState<string | null>(null);
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "live" | "simulated" | "denied">(
    "idle"
  );
  const [lastPingAt, setLastPingAt] = useState<Date | null>(null);
  const simulatedPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const id = getActiveDonorId();
    if (!id) {
      router.replace("/donor");
      return;
    }
    setDonorId(id);
    apiGet<Dispatch>(`/api/donor/dispatch?dispatch_id=${dispatchId}`).then(
      ({ data, error: err }) => {
        if (err) setError(err);
        else setDispatch(data);
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatchId]);

  const sendPing = useCallback(
    async (lat: number, lng: number) => {
      if (!donorId) return;
      const { data, error: err } = await apiPost<Dispatch>(
        "/api/donor/location",
        { donor_id: donorId, dispatch_id: dispatchId, lat, lng }
      );
      if (!err && data) {
        setDispatch(data);
        setLastPingAt(new Date());
      }
    },
    [donorId, dispatchId]
  );

  // Periodic "share my location" ping (every 12s). Tries real geolocation
  // first; falls back to a simulated moving position if permission is
  // denied / unsupported so the en-route demo never breaks.
  useEffect(() => {
    if (!donorId || !dispatchId) return;
    if (dispatch && dispatch.status !== "en_route") return;

    const hasGeo = typeof navigator !== "undefined" && "geolocation" in navigator;

    function pingOnce() {
      if (hasGeo) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGeoStatus("live");
            sendPing(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            setGeoStatus("simulated");
            const next = nextSimulatedPosition(simulatedPosRef.current);
            simulatedPosRef.current = next;
            sendPing(next.lat, next.lng);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        setGeoStatus("simulated");
        const next = nextSimulatedPosition(simulatedPosRef.current);
        simulatedPosRef.current = next;
        sendPing(next.lat, next.lng);
      }
    }

    pingOnce();
    const interval = setInterval(pingOnce, PING_INTERVAL_MS);
    return () => clearInterval(interval);
    // Intentionally depend only on dispatch?.status (not the whole `dispatch`
    // object) - we just need to stop pinging once status leaves "en_route".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donorId, dispatchId, dispatch?.status, sendPing]);

  async function handleCancel() {
    if (!dispatchId) return;
    // /api/dispatch/cancel belongs to Person 4; if not built yet this call
    // will apiError() gracefully and we still navigate the donor away.
    await apiPost("/api/dispatch/cancel", {
      dispatch_id: dispatchId,
      reason: "donor_cancelled",
    });
    router.push("/donor/notifications");
  }
  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-raksha-700">🚑 You&apos;re en route!</h1>
      <p className="mb-6 text-sm text-gray-500">
        Thank you for responding. Keep this screen open so the hospital can
        track your ETA.
      </p>

      {error && (
        <p className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <>
          <Card className="mb-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Status</span>
              <Badge tone={dispatch ? STATUS_TONE[dispatch.status] : "neutral"}>
                {(dispatch?.status ?? "en_route").replace("_", " ")}
              </Badge>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">ETA</span>
              <span className="text-2xl font-bold text-raksha-700">
                {dispatch?.eta_minutes != null ? `${dispatch.eta_minutes} min` : "calculating…"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Movement</span>
              <span className="text-xs text-gray-400">
                {dispatch?.started_moving_at ? "✅ Moving detected" : "⏳ Waiting for movement"}
              </span>
            </div>
          </Card>

          <Card className="mb-6">
            <div className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full ${
                  geoStatus === "live"
                    ? "bg-success animate-pulse"
                    : geoStatus === "simulated"
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-gray-300"
                }`}
              />
              <p className="text-sm text-gray-600">
                {geoStatus === "live"
                  ? "📍 Sharing live location"
                  : geoStatus === "simulated"
                  ? "📍 Sharing simulated location (GPS denied/unavailable)"
                  : "Waiting to share location…"}
              </p>
            </div>
            {lastPingAt && (
              <p className="mt-1 text-xs text-gray-400">
                Last ping: {lastPingAt.toLocaleTimeString()}
              </p>
            )}
          </Card>

          <Button variant="secondary" size="lg" fullWidth onClick={handleCancel}>
            Cancel
          </Button>
        </>
      )}
    </main>
  );
}

