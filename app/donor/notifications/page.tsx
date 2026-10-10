// Donor notification feed: pending SOS requests with big Yes/No buttons.
// No opens the snooze modal; Yes starts the en-route flow. Feature: Donor UI (Person 3).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  getActiveDonorId,
  getActiveDonorName,
  clearActiveDonor,
} from "../donor-session";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BloodGroupTag } from "@/components/ui/BloodGroupTag";
import { Modal } from "@/components/ui/Modal";
import type { BloodGroup, Dispatch, SnoozeOption, Urgency } from "@/lib/types";

interface NotificationSos {
  id: string;
  blood_group: BloodGroup;
  units_needed: number;
  urgency: Urgency;
  status: string;
  patient_note: string | null;
  created_at: string;
  hospital_name: string | null;
  hospital_address: string | null;
}

interface NotificationRow {
  id: string;
  sos_id: string;
  donor_id: string;
  distance_km: number;
  status: "sent" | "accepted" | "declined" | "expired";
  sent_at: string;
  responded_at: string | null;
  sos: NotificationSos | null;
}

const SNOOZE_OPTIONS: { value: SnoozeOption; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "24h", label: "24 hours" },
  { value: "today", label: "Today (until 11:59pm)" },
];

export default function DonorNotificationsPage() {
  const router = useRouter();
  const [donorId, setDonorId] = useState<string | null>(null);
  const [donorName, setDonorName] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [snoozeTargetId, setSnoozeTargetId] = useState<string | null>(null);
  const [snoozing, setSnoozing] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const refresh = useCallback(async (id: string) => {
    const { data, error: err } = await apiGet<NotificationRow[]>(
      `/api/donor/notifications?donor_id=${id}&status=sent`
    );
    if (err) setError(err);
    else {
      setError(null);
      setNotifications(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = getActiveDonorId();
    if (!id) {
      router.replace("/donor");
      return;
    }
    setDonorId(id);
    setDonorName(getActiveDonorName());
    refresh(id);
    // Poll so newly broadcast SOS requests show up without Realtime wired here.
    const interval = setInterval(() => refresh(id), 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleYes(notification: NotificationRow) {
    if (!donorId) return;
    setRespondingId(notification.id);
    setActionError(null);
    const { data, error: err } = await apiPost<{ dispatch: Dispatch | null }>(
      "/api/donor/respond",
      { notification_id: notification.id, donor_id: donorId, response: "yes" }
    );
    setRespondingId(null);
    if (err || !data?.dispatch) {
      setActionError(err ?? "Failed to accept - try again");
      return;
    }
    router.push(`/donor/en-route/${data.dispatch.id}`);
  }

  function handleNo(notificationId: string) {
    setSnoozeTargetId(notificationId);
  }

  async function handleSnoozeConfirm(option: SnoozeOption) {
    if (!donorId || !snoozeTargetId) return;
    setSnoozing(true);
    setActionError(null);

    // Decline the notification itself, then apply the snooze window.
    const [{ error: respondErr }, { error: snoozeErr }] = await Promise.all([
      apiPost("/api/donor/respond", {
        notification_id: snoozeTargetId,
        donor_id: donorId,
        response: "no",
      }),
      apiPost("/api/donor/snooze", { donor_id: donorId, option }),
    ]);
    setSnoozing(false);
    setSnoozeTargetId(null);
    if (respondErr || snoozeErr) {
      setActionError(respondErr ?? snoozeErr ?? "Failed to snooze");
      return;
    }
    if (donorId) refresh(donorId);
  }

  function handleLogout() {
    clearActiveDonor();
    router.push("/donor");
  }

  return (
    <main className="mx-auto min-h-screen max-w-md pb-10">
      <header className="flex items-center justify-between bg-raksha-700 px-4 py-4 text-white shadow-card">
        <div>
          <h1 className="text-lg font-bold">🩸 {donorName ?? "Donor"}</h1>
          <p className="text-xs text-raksha-100">RakshaRakt Notifications</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/donor/profile"
            className="min-h-12 rounded-lg bg-raksha-800 px-3 py-2 text-sm hover:bg-raksha-900 flex items-center"
          >
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="min-h-12 rounded-lg bg-raksha-800 px-3 py-2 text-sm hover:bg-raksha-900"
          >
            Switch
          </button>
        </div>
      </header>

      <div className="px-4 py-6">
        {error && (
          <p className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Couldn&apos;t load notifications yet ({error}). Try again shortly.
          </p>
        )}
        {actionError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-critical">
            {actionError}
          </p>
        )}
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : notifications.length === 0 ? (
          <Card className="border-dashed text-center text-gray-400">
            No pending requests right now. We&apos;ll alert you the moment a
            nearby hospital needs your blood group. 🙏
          </Card>
        ) : (
          <ul className="space-y-4">
            {notifications.map((n) => (
              <li key={n.id}>
                <Card>
                  <div className="mb-3 flex items-center gap-3">
                    <BloodGroupTag
                      bloodGroup={n.sos?.blood_group ?? "O+"}
                      size="lg"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">
                        {n.sos?.hospital_name ?? "Hospital"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {n.distance_km.toFixed(1)}km away ·{" "}
                        {n.sos?.units_needed ?? "?"} unit(s) needed
                      </p>
                    </div>
                    <Badge tone={n.sos?.urgency === "critical" ? "critical" : "primary"}>
                      {(n.sos?.urgency ?? "normal").toUpperCase()}
                    </Badge>
                  </div>

                  {n.sos?.patient_note && (
                    <p className="mb-3 text-sm text-gray-600">
                      {n.sos.patient_note}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="danger"
                      size="lg"
                      disabled={respondingId === n.id}
                      onClick={() => handleYes(n)}
                    >
                      {respondingId === n.id ? "…" : "✅ Yes, I can donate"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      disabled={respondingId === n.id}
                      onClick={() => handleNo(n.id)}
                    >
                      ❌ Not now
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={snoozeTargetId !== null}
        onClose={() => setSnoozeTargetId(null)}
        title="Snooze notifications"
      >
        <p className="mb-4 text-sm text-gray-500">
          We won&apos;t notify you again until:
        </p>
        <div className="grid grid-cols-1 gap-3">
          {SNOOZE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="secondary"
              size="lg"
              disabled={snoozing}
              onClick={() => handleSnoozeConfirm(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </Modal>
    </main>
  );
}

