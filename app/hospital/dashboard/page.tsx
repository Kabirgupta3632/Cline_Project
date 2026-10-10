// Hospital dashboard: lists this hospital's active SOS requests and a button
// to raise a new one. Feature: Hospital UI (Person 2).
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getActiveHospitalId, getActiveHospitalName, clearActiveHospital } from "../hospital-session";
import type { SosRequest } from "@/lib/types";

export default function HospitalDashboardPage() {
  const router = useRouter();
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [hospitalName, setHospitalName] = useState<string | null>(null);
  const [sosList, setSosList] = useState<SosRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (id: string) => {
    const { data, error: err } = await apiGet<SosRequest[]>(
      `/api/sos/list?hospital_id=${id}`
    );
    if (err) setError(err);
    else {
      setError(null);
      setSosList(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = getActiveHospitalId();
    if (!id) {
      router.replace("/hospital");
      return;
    }
    setHospitalId(id);
    setHospitalName(getActiveHospitalName());
    refresh(id);

    // Live updates via Supabase Realtime on sos_requests (enabled in the
    // Realtime publication in db/schema.sql) - new SOS rows, status flips
    // (inventory_check -> broadcasting -> fulfilled), and radius escalation
    // all show up instantly without the client needing to poll. We still
    // keep a slow 60s polling fallback below in case the Realtime channel
    // silently fails to connect (e.g. Realtime not enabled on the project,
    // network blip) so the dashboard never goes permanently stale.
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`hospital-dashboard-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sos_requests",
          filter: `hospital_id=eq.${id}`,
        },
        () => refresh(id)
      )
      .subscribe();

    // Slow fallback poll - safety net only, not the primary update path.
    const fallbackInterval = setInterval(() => refresh(id), 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallbackInterval);
    };
  }, [router, refresh]);

  function handleLogout() {
    clearActiveHospital();
    router.push("/hospital");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-raksha-700 text-white px-6 py-4 flex items-center justify-between shadow-card">
        <div>
          <h1 className="text-xl font-bold">🏥 {hospitalName ?? "Hospital"}</h1>
          <p className="text-xs text-raksha-100">RakshaRakt Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/hospital/impact"
            className="rounded-lg bg-raksha-800 px-3 py-2 text-sm hover:bg-raksha-900"
          >
            📊 Impact
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-raksha-800 px-3 py-2 text-sm hover:bg-raksha-900"
          >
            Switch hospital
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Active SOS Requests
          </h2>
          <Link
            href="/hospital/sos/new"
            className="rounded-lg bg-raksha-600 px-4 py-3 text-sm font-semibold text-white shadow-card hover:bg-raksha-700"
          >
            + Raise New SOS
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Couldn&apos;t load SOS list yet ({error}). This endpoint may still
            be under construction by another teammate - try again shortly.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : sosList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-400">
            No active SOS requests. Click &quot;Raise New SOS&quot; to broadcast
            an emergency need.
          </div>
        ) : (
          <ul className="space-y-3">
            {sosList.map((sos) => (
              <SosRow key={sos.id} sos={sos} hospitalId={hospitalId!} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function SosRow({ sos }: { sos: SosRequest; hospitalId: string }) {
  const urgencyColor =
    sos.urgency === "critical"
      ? "bg-critical text-white"
      : "bg-raksha-100 text-raksha-700";
  const statusColor: Record<string, string> = {
    inventory_check: "bg-yellow-100 text-yellow-800",
    broadcasting: "bg-blue-100 text-blue-800",
    fulfilled: "bg-success/10 text-success",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <Link
      href={`/hospital/sos/${sos.id}`}
      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-card hover:border-raksha-400"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-raksha-50 font-bold text-raksha-700">
          {sos.blood_group}
        </span>
        <div>
          <p className="font-semibold text-gray-800">
            {sos.units_needed} unit(s) needed · {sos.units_fulfilled} fulfilled
          </p>
          <p className="text-xs text-gray-400">
            Radius {sos.radius_km}km · {new Date(sos.created_at).toLocaleTimeString()}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${urgencyColor}`}>
          {sos.urgency.toUpperCase()}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            statusColor[sos.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {sos.status.replace("_", " ")}
        </span>
      </div>
    </Link>
  );
}
