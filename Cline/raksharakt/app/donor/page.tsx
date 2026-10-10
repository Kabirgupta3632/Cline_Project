// "Login as [Donor]" role switcher - picks a seeded donor row, no real auth.
// Feature: Donor UI (Person 3).
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { setActiveDonor } from "./donor-session";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BloodGroupTag } from "@/components/ui/BloodGroupTag";
import type { BloodGroup } from "@/lib/types";

interface DonorOption {
  id: string;
  name: string;
  blood_group: BloodGroup;
}

// Fallback sample donors shown if GET /api/roles/seed-options is unreachable
// or the donors table isn't seeded yet - keeps the demo from ever dead-ending.
const MOCK_DONORS: DonorOption[] = [
  { id: "mock-donor-1", name: "Rahul Sharma (mock)", blood_group: "O+" },
  { id: "mock-donor-2", name: "Priya Das (mock)", blood_group: "A+" },
  { id: "mock-donor-3", name: "Nilakshi Bora (mock)", blood_group: "O-" },
];

export default function DonorLoginPage() {
  const router = useRouter();
  const [donors, setDonors] = useState<DonorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    apiGet<{ donors: DonorOption[] }>("/api/roles/seed-options").then(
      ({ data }) => {
        const list = data?.donors?.length ? data.donors : MOCK_DONORS;
        setUsingMock(!data?.donors?.length);
        setDonors(list);
        if (list[0]) setSelected(list[0].id);
        setLoading(false);
      }
    );
  }, []);

  function handleContinue() {
    const donor = donors.find((d) => d.id === selected);
    if (!donor) return;
    setActiveDonor(donor.id, donor.name, donor.blood_group);
    router.push("/donor/notifications");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <Card className="w-full">
        <h1 className="mb-1 text-2xl font-bold text-raksha-700">🩸 Donor Login</h1>
        <p className="mb-6 text-sm text-gray-500">
          Select your name to continue (demo role switcher, no password).
        </p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading donors…</p>
        ) : (
          <>
            {usingMock && (
              <p className="mb-3 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
                Using mock donor list - seed data not reachable yet.
              </p>
            )}
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Donor
            </label>
            <select
              className="mb-4 w-full min-h-12 rounded-lg border border-gray-300 px-3 text-base focus:border-raksha-500 focus:outline-none focus:ring-2 focus:ring-raksha-200"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.blood_group})
                </option>
              ))}
            </select>

            {selected && (
              <div className="mb-6 flex items-center gap-2">
                <BloodGroupTag
                  bloodGroup={
                    donors.find((d) => d.id === selected)?.blood_group ?? "O+"
                  }
                />
                <span className="text-sm text-gray-500">Your blood group</span>
              </div>
            )}

            <Button fullWidth size="lg" onClick={handleContinue}>
              Continue to Notifications
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
