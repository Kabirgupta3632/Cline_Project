'use client';
import { useEffect, useState, useRef } from "react";
import { apiPost } from "@/lib/api-client";
import type { DispatchStatus, DonorPublic } from "@/lib/types";

// Extracted from the API response
export interface DispatchRow {
  id: string;
  donor_id: string;
  status: DispatchStatus;
  eta_minutes: number | null;
  accepted_at: string | null;
  donor: DonorPublic | null;
  // added locally for simulated ticking
  _simulated_seconds_remaining?: number;
}

export default function DispatchPanel({ sosId, initialDispatches, onConfirmDonated }: { sosId: string, initialDispatches: DispatchRow[], onConfirmDonated: (dispatchId: string) => void }) {
  const [dispatches, setDispatches] = useState<DispatchRow[]>(initialDispatches);
  
  // Realtime ticking logic
  useEffect(() => {
    setDispatches(initialDispatches.map(d => ({
      ...d,
      _simulated_seconds_remaining: d.eta_minutes ? d.eta_minutes * 60 : 0
    })));
  }, [initialDispatches]);

  useEffect(() => {
    const ticker = setInterval(() => {
      setDispatches(prev => prev.map(d => {
        if (d.status !== 'en_route' || d._simulated_seconds_remaining === undefined || d._simulated_seconds_remaining <= 0) {
          return d;
        }
        return { ...d, _simulated_seconds_remaining: d._simulated_seconds_remaining - 1 };
      }));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Anti-ghosting rule 6: hospital dashboard triggers ghost-sweep on an interval
  const [events, setEvents] = useState<{id: number, text: string}[]>([]);
  const nextEventId = useRef(1);
  
  useEffect(() => {
    if (!sosId) return;
    
    // Check for ghost-sweep periodically
    const sweep = async () => {
      try {
        const { data, error } = await apiPost<{ ghosted: string[], replacement_notified: string[] }>("/api/dispatch/ghost-sweep", { sos_id: sosId });
        if (!error && data && (data.ghosted?.length > 0 || data.replacement_notified?.length > 0)) {
           setEvents(prev => [
             { id: nextEventId.current++, text: `Ghost sweep: ${data.ghosted?.length || 0} ghosted, ${data.replacement_notified?.length || 0} re-notified.` },
             ...prev
           ].slice(0, 10));
        }
      } catch (err) {
        console.error("sweep error", err);
      }
    };
    
    // We'll run it every 15s per requirements
    const interval = setInterval(sweep, 15000);
    return () => clearInterval(interval);
  }, [sosId]);

  if (dispatches.length === 0) return null;

  const statusColor: Record<string, string> = {
    en_route: "bg-blue-100 text-blue-700",
    arrived: "bg-amber-100 text-amber-700",
    donated: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
    ghosted: "bg-red-100 text-red-700",
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-200 mt-6">
      <h2 className="font-semibold text-gray-800 mb-3">
        Live Dispatch Dashboard ({dispatches.length})
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {dispatches.map((d) => {
            const isDelayed = d.status === "en_route" && d.eta_minutes !== null && (d._simulated_seconds_remaining || 0) < (d.eta_minutes * 60) * 0.2; // simulate delay logic
            const statusLabel = d.status === "en_route" && isDelayed ? "delayed" : d.status;
            const currentStatusColor = statusLabel === "delayed" ? "bg-amber-100 text-amber-700" : statusColor[d.status];

            return (
              <div key={d.id} className="border rounded-lg p-4 flex flex-col gap-2 relative overflow-hidden bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-700">
                      {d.donor?.name ?? "Unknown donor"} <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{d.donor?.blood_group}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1 font-mono">
                      ETA: {d.status === "en_route" && d._simulated_seconds_remaining !== undefined 
                              ? `${Math.floor(d._simulated_seconds_remaining / 60)}m ${d._simulated_seconds_remaining % 60}s` 
                              : (d.eta_minutes != null ? `${d.eta_minutes} min` : "—")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${currentStatusColor} uppercase`}>
                      {statusLabel.replace("_", " ")}
                    </span>
                    {(d.status === "en_route" || d.status === "arrived") && (
                      <button
                        onClick={() => onConfirmDonated(d.id)}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition"
                      >
                        ✅ Confirm donated
                      </button>
                    )}
                  </div>
                </div>
                
                {d.status === "en_route" && d.eta_minutes && (
                  <div className="w-full bg-gray-200 h-1.5 rounded-full mt-1">
                    <div 
                      className={`h-1.5 rounded-full ${isDelayed ? 'bg-amber-500' : 'bg-blue-500'}`} 
                      style={{ width: `${Math.max(0, Math.min(100, 100 - ((d._simulated_seconds_remaining || 0) / (d.eta_minutes * 60)) * 100))}%` }}
                    ></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="md:col-span-1 border rounded-lg bg-gray-50 p-3 h-full max-h-64 overflow-y-auto">
          <h3 className="font-semibold text-gray-700 text-sm mb-2 sticky top-0 bg-gray-50 pb-1 border-b">Event Timeline</h3>
          <ul className="space-y-2 text-xs">
            {events.length === 0 ? (
              <li className="text-gray-400 italic">Waiting for events...</li>
            ) : (
              events.map((ev) => (
                <li key={ev.id} className="text-gray-700 border-l-2 border-red-400 pl-2 py-1">
                  {ev.text}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
