// Impact dashboard: aggregate stats for judges (total SOS fulfilled, avg
// response time, donors currently active). Feature: Hospital UI (Person 2).
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";
import { getActiveHospitalId, getActiveHospitalName } from "../hospital-session";

interface ImpactStats {
  total_sos: number;
  total_fulfilled: number;
  avg_response_minutes: number | null;
  donors_active_now: number;
  total_donations_confirmed: number;
}

export default function ImpactPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hospitalName, setHospitalName] = useState<string | null>(null);

  useEffect(() => {
    const id = getActiveHospitalId();
    if (!id) {
      router.replace("/hospital");
      return;
    }
    setHospitalName(getActiveHospitalName());

    async function load() {
      const { data, error: err } = await apiGet<ImpactStats>(
        `/api/sos/impact?hospital_id=${id}`
      );
      if (err) setError(err);
      else setStats(data);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-raksha-700 text-white px-6 py-4 flex items-center justify-between shadow-card">
        <div>
          <h1 className="text-xl font-bold">📊 Impact Dashboard</h1>
          <p className="text-xs text-raksha-100">{hospitalName ?? "Hospital"}</p>
        </div>
        <Link
          href="/hospital/dashboard"
          className="rounded-lg bg-raksha-800 px-3 py-2 text-sm hover:bg-raksha-900"
        >
          Back to Dashboard
        </Link>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : error || !stats ? (
          <p className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Couldn&apos;t load impact stats yet ({error ?? "no data"}).
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total SOS Raised" value={stats.total_sos} emoji="🚨" />
            <StatCard label="SOS Fulfilled" value={stats.total_fulfilled} emoji="✅" />
            <StatCard
              label="Avg Response Time"
              value={
                stats.avg_response_minutes != null
                  ? `${stats.avg_response_minutes} min`
                  : "—"
              }
              emoji="⏱️"
            />
            <StatCard label="Donors Active Now" value={stats.donors_active_now} emoji="🏃" />
            <StatCard
              label="Donations Confirmed"
              value={stats.total_donations_confirmed}
              emoji="🩸"
            />
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, emoji }: { label: string; value: string | number; emoji: string }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-card border border-gray-200 text-center">
      <div className="text-3xl mb-2">{emoji}</div>
      <div className="text-3xl font-extrabold text-raksha-700">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}
