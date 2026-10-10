// "Login as [Hospital]" role switcher - picks a seeded hospital row, no real
// auth. Feature: Hospital UI (Person 2).
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { setActiveHospital } from "./hospital-session";

interface HospitalOption {
  id: string;
  name: string;
}

export default function HospitalLoginPage() {
  const router = useRouter();
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    apiGet<{ hospitals: HospitalOption[] }>("/api/roles/seed-options").then(
      ({ data }) => {
        setHospitals(data?.hospitals ?? []);
        if (data?.hospitals?.[0]) setSelected(data.hospitals[0].id);
        setLoading(false);
      }
    );
  }, []);

  function handleContinue() {
    const hospital = hospitals.find((h) => h.id === selected);
    if (!hospital) return;
    setActiveHospital(hospital.id, hospital.name);
    router.push("/hospital/dashboard");
  }

  return (
    <main className="min-h-screen bg-raksha-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-card border border-raksha-100">
        <h1 className="text-2xl font-bold text-raksha-700 mb-1">
          🏥 Hospital Login
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Select your hospital to continue (demo role switcher, no password).
        </p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading hospitals…</p>
        ) : hospitals.length === 0 ? (
          <p className="text-sm text-critical">
            No hospitals found. Run db/seed.sql against Supabase first.
          </p>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hospital
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base mb-6 focus:border-raksha-500 focus:outline-none focus:ring-2 focus:ring-raksha-200"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleContinue}
              className="w-full rounded-lg bg-raksha-600 py-3 text-base font-semibold text-white shadow-card transition hover:bg-raksha-700 active:bg-raksha-800"
            >
              Continue to Dashboard
            </button>
          </>
        )}
      </div>
    </main>
  );
}
