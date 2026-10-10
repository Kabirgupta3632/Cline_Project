// Donor notification feed: pending SOS requests with big Yes/No buttons.
// No opens the snooze modal; Yes starts the en-route flow. Feature: Donor UI (Person 3).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api-client";
import { getSupabaseBrowserClient } from "@/lib/supabase";
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
import {
  DONOR_STRINGS,
  LANG_LABELS,
  getStoredLang,
  setStoredLang,
  type Lang,
} from "../i18n";

/** Short Web Audio beep (no binary asset needed) for the critical-urgency
 * siren alert - two quick high-pitched tones. Falls back to silently no-op
 * if AudioContext isn't available (e.g. some browsers before first gesture). */
function playSirenBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const playTone = (freq: number, startAt: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + startAt);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration + 0.05);
    };
    playTone(880, 0, 0.18);
    playTone(660, 0.22, 0.18);
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Non-critical - siren sound is a nice-to-have, never break the page.
  }
}

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
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [lang, setLang] = useState<Lang>("en");
  const seenNotifIdsRef = useRef<Set<string> | null>(null);
  const t = DONOR_STRINGS[lang];

  useEffect(() => {
    setLang(getStoredLang());
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission("unsupported");
    }
  }, []);

  function handleLangChange(next: Lang) {
    setLang(next);
    setStoredLang(next);
  }

  async function handleEnableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }

  const refresh = useCallback(async (id: string) => {
    const { data, error: err } = await apiGet<NotificationRow[]>(
      `/api/donor/notifications?donor_id=${id}&status=sent`
    );
    if (err) setError(err);
    else {
      setError(null);
      const rows = data ?? [];

      // Fire a local Notification (+ siren beep for critical urgency) for any
      // row we haven't seen before - works even while this tab is
      // backgrounded, since Notification() doesn't require focus. First
      // refresh ever just seeds the "seen" set silently (no spam on load).
      const seen = seenNotifIdsRef.current;
      if (seen !== null) {
        const freshOnes = rows.filter((r) => !seen.has(r.id));
        for (const row of freshOnes) {
          if (row.sos?.urgency === "critical") playSirenBeep();
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification(`🩸 Blood needed: ${row.sos?.blood_group ?? ""}`, {
              body: `${row.sos?.hospital_name ?? "A hospital"} needs ${
                row.sos?.units_needed ?? "?"
              } unit(s)${row.sos?.urgency === "critical" ? " - CRITICAL" : ""}`,
              tag: row.id,
            });
          }
        }
      }
      seenNotifIdsRef.current = new Set(rows.map((r) => r.id));

      setNotifications(rows);
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

    // Live updates via Supabase Realtime on notifications filtered to this
    // donor (enabled in the Realtime publication in db/schema.sql) - new SOS
    // broadcasts appear instantly without a manual refresh or fast poll. A
    // slow 60s fallback poll remains as a safety net in case the Realtime
    // channel fails to connect (e.g. not enabled on the project, network
    // blip), so the feed never goes permanently stale.
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`donor-notifications-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `donor_id=eq.${id}`,
        },
        () => refresh(id)
      )
      .subscribe();

    const fallbackInterval = setInterval(() => refresh(id), 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallbackInterval);
    };
  }, [router, refresh]);

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
          <p className="text-xs text-raksha-100">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/donor/profile"
            className="min-h-12 rounded-lg bg-raksha-800 px-3 py-2 text-sm hover:bg-raksha-900 flex items-center"
          >
            {t.profile}
          </Link>
          <button
            onClick={handleLogout}
            className="min-h-12 rounded-lg bg-raksha-800 px-3 py-2 text-sm hover:bg-raksha-900"
          >
            {t.switchRole}
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <select
          value={lang}
          onChange={(e) => handleLangChange(e.target.value as Lang)}
          aria-label="Language"
          className="min-h-12 rounded-lg border border-gray-300 px-2 text-sm focus:border-raksha-500 focus:outline-none focus:ring-2 focus:ring-raksha-200"
        >
          {(Object.keys(LANG_LABELS) as Lang[]).map((code) => (
            <option key={code} value={code}>
              {LANG_LABELS[code]}
            </option>
          ))}
        </select>

        {notifPermission !== "unsupported" && (
          <button
            onClick={handleEnableNotifications}
            disabled={notifPermission === "granted"}
            className="min-h-12 rounded-lg border border-raksha-300 bg-raksha-50 px-3 py-2 text-sm font-semibold text-raksha-700 hover:bg-raksha-100 disabled:opacity-60"
          >
            {notifPermission === "granted" ? t.alertsEnabled : t.enableAlerts}
          </button>
        )}
      </div>

      <div className="px-4 py-6">
        {error && (
          <p className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            {t.loadError} ({error}). Try again shortly.
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
            {t.noPending}
          </Card>
        ) : (
          <ul className="space-y-4">
            {notifications.map((n) => {
              const isCritical = n.sos?.urgency === "critical";
              return (
              <li key={n.id}>
                <Card
                  className={
                    isCritical
                      ? "animate-pulse border-2 border-critical shadow-[0_0_0_4px_rgba(217,4,41,0.15)]"
                      : undefined
                  }
                >
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
                        {n.distance_km.toFixed(1)}km {t.away} ·{" "}
                        {n.sos?.units_needed ?? "?"} {t.unitsNeeded}
                      </p>
                    </div>
                    <Badge tone={isCritical ? "critical" : "primary"}>
                      {isCritical && "🚨 "}
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
                      {respondingId === n.id ? "…" : t.yes}
                    </Button>
                    <Button
                      variant="secondary"
                      size="lg"
                      disabled={respondingId === n.id}
                      onClick={() => handleNo(n.id)}
                    >
                      {t.no}
                    </Button>
                  </div>
                </Card>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={snoozeTargetId !== null}
        onClose={() => setSnoozeTargetId(null)}
        title={t.snoozeTitle}
      >
        <p className="mb-4 text-sm text-gray-500">
          {t.snoozeSubtitle}
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

