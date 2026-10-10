// Raise New SOS: optional requisition-slip photo OCR (Gemini) pre-fills the
// form, then POSTs /api/sos/create. Feature: Hospital UI (Person 2).
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { getActiveHospitalId } from "../../hospital-session";
import type { SosRequest, BloodGroup } from "@/lib/types";

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface SlipExtraction {
  blood_group: BloodGroup | null;
  units_needed: number | null;
  patient_note: string | null;
  urgency_hint: "normal" | "critical" | null;
  raw_text: string;
  source: "gemini" | "mock";
}

export default function NewSosPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bloodGroup, setBloodGroup] = useState<BloodGroup>("O+");
  const [unitsNeeded, setUnitsNeeded] = useState(2);
  const [urgency, setUrgency] = useState<"normal" | "critical">("normal");
  const [patientNote, setPatientNote] = useState("");
  const [rawSlipText, setRawSlipText] = useState<string | null>(null);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSource, setOcrSource] = useState<"gemini" | "mock" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice input (Tier 3): browser SpeechRecognition dictates into the
  // patient-note field as an alternative to typing or photo upload.
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

  // Family/relative request note (Tier 3): purely informational flag - no
  // schema column exists for this yet, so we fold it into patient_note on
  // submit rather than block on a Person 1 migration.
  const [isFamilyRequest, setIsFamilyRequest] = useState(false);
  const [requestedByName, setRequestedByName] = useState("");

  async function handleSlipUpload(file: File) {
    setOcrLoading(true);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const { data, error: err } = await apiPost<SlipExtraction>(
        "/api/ai/extract-slip",
        { image_base64: base64, mime_type: file.type || "image/jpeg" }
      );
      if (err || !data) {
        setError(err ?? "Slip extraction failed");
      } else {
        if (data.blood_group) setBloodGroup(data.blood_group);
        if (data.units_needed) setUnitsNeeded(data.units_needed);
        if (data.urgency_hint) setUrgency(data.urgency_hint);
        if (data.patient_note) setPatientNote(data.patient_note);
        setRawSlipText(data.raw_text);
        setOcrSource(data.source);
      }
    } finally {
      setOcrLoading(false);
    }
  }

  /**
   * Starts the browser's SpeechRecognition API (Web Speech API) and appends
   * the transcript to the patient-note field as an alternative input method
   * to photo upload / typing. Falls back silently (voiceSupported=false) on
   * browsers without support (e.g. Firefox) so the rest of the form still
   * works - this is a bonus feature, never a blocker.
   */
  function handleVoiceInput() {
    type SpeechRecognitionCtor = new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setPatientNote((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    setIsListening(true);
    recognition.start();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hospitalId = getActiveHospitalId();
    if (!hospitalId) {
      router.replace("/hospital");
      return;
    }
    setSubmitting(true);
    setError(null);

    // Family/relative request: fold into patient_note since no schema column
    // exists for this yet (coordinate with Person 1 if a dedicated column is
    // added later). Keeps the hospital-desk-only safety rule visible to staff
    // reading the note without requiring a backend change to ship this.
    const fullNote = isFamilyRequest
      ? `[Requested by family member: ${requestedByName || "name not given"} - via hospital desk]${
          patientNote ? " " + patientNote : ""
        }`
      : patientNote;

    // /api/sos/create returns a richer envelope than a bare SosRequest - it
    // also runs the Inventory Mesh check (rule 4) and, for critical urgency,
    // an auto transfer-request + broadcast done in parallel server-side.
    const { data, error: err } = await apiPost<{ sos: SosRequest }>(
      "/api/sos/create",
      {
        hospital_id: hospitalId,
        blood_group: bloodGroup,
        units_needed: unitsNeeded,
        urgency,
        patient_note: fullNote || undefined,
        raw_slip_text: rawSlipText || undefined,
      }
    );
    setSubmitting(false);
    if (err || !data) {
      setError(err ?? "Failed to create SOS");
      return;
    }
    router.push(`/hospital/sos/${data.sos.id}`);
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="mx-auto max-w-lg rounded-xl bg-white p-6 shadow-card border border-gray-200">
        <h1 className="text-xl font-bold text-raksha-700 mb-1">🚨 Raise New SOS</h1>
        <p className="text-sm text-gray-500 mb-6">
          Upload a requisition slip photo for AI auto-fill, or enter details
          manually below.
        </p>

        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSlipUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrLoading}
            className="w-full rounded-lg border-2 border-dashed border-raksha-300 bg-raksha-50 py-4 text-sm font-medium text-raksha-700 hover:bg-raksha-100 disabled:opacity-60"
          >
            {ocrLoading ? "Reading slip with Gemini…" : "📷 Upload Requisition Slip (AI OCR)"}
          </button>
          {ocrSource && (
            <p className="mt-1 text-xs text-gray-400">
              Auto-filled via {ocrSource === "gemini" ? "Gemini Vision" : "deterministic mock (no API key / offline)"}.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
            <select
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-raksha-500 focus:outline-none"
            >
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Units Needed</label>
            <input
              type="number"
              min={1}
              value={unitsNeeded}
              onChange={(e) => setUnitsNeeded(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-raksha-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUrgency("normal")}
                className={`rounded-lg border-2 py-3 text-sm font-semibold ${
                  urgency === "normal"
                    ? "border-raksha-500 bg-raksha-50 text-raksha-700"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                Normal (5km)
              </button>
              <button
                type="button"
                onClick={() => setUrgency("critical")}
                className={`rounded-lg border-2 py-3 text-sm font-semibold ${
                  urgency === "critical"
                    ? "border-critical bg-red-50 text-critical"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                🔴 Critical (15km+)
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Patient Note (optional)</label>
              {voiceSupported && (
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isListening
                      ? "bg-critical text-white animate-pulse"
                      : "bg-raksha-100 text-raksha-700 hover:bg-raksha-200"
                  }`}
                >
                  {isListening ? "🎙️ Listening…" : "🎙️ Dictate"}
                </button>
              )}
            </div>
            <textarea
              value={patientNote}
              onChange={(e) => setPatientNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-raksha-500 focus:outline-none"
              placeholder="e.g. Ward 4, Dr. Mehta, post-surgical bleed"
            />
            {!voiceSupported && (
              <p className="mt-1 text-xs text-gray-400">
                Voice dictation isn&apos;t supported in this browser - type the note manually.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isFamilyRequest}
                onChange={(e) => setIsFamilyRequest(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-raksha-600 focus:ring-raksha-500"
              />
              Requested by a family member via hospital desk
            </label>
            {isFamilyRequest && (
              <input
                type="text"
                value={requestedByName}
                onChange={(e) => setRequestedByName(e.target.value)}
                placeholder="Family member's name"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-raksha-500 focus:outline-none"
              />
            )}
            <p className="mt-1 text-xs text-gray-400">
              Keeps SOS creation hospital-desk-gated even when a relative initiates the request.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-critical">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-raksha-600 py-3 text-base font-semibold text-white shadow-card hover:bg-raksha-700 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Check Inventory & Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix - Gemini wants raw base64.
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
