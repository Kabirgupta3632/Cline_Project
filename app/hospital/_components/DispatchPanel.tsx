// Realtime Live Dispatch Dashboard
// Feature: Hospital UI - Shows donors en route, ETAs, and ghosting logic

'use client';

import { useEffect, useState } from 'react';
import { DispatchWithDonor } from '@/lib/types';
import { supabase } from '@/lib/supabase';

// Extend DispatchWithDonor for local UI state
interface UIEnhancedDispatch extends DispatchWithDonor {
  ghost_risk?: boolean;
}

export default function DispatchPanel({ sosId }: { sosId: string }) {
  const [dispatches, setDispatches] = useState<UIEnhancedDispatch[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDispatches = async () => {
    try {
      const res = await fetch(`/api/dispatch?sos_id=${sosId}`);
      const json = await res.json();
      if (json.ok) {
        setDispatches(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatches();

    const sub = supabase
      .channel('dispatches_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dispatches', filter: `sos_id=eq.${sosId}` },
        (payload) => {
          fetchDispatches();
        }
      )
      .subscribe();

    const ghostSweepInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/dispatch/ghost-sweep', { method: 'POST' });
        const json = await res.json();
        if (json.ok && json.data.ghosts_found > 0) {
          setEvents(prev => [`Ghost Sweep: found ${json.data.ghosts_found} ghost(s), re-matching...`, ...prev].slice(0, 10));
          fetchDispatches();
        }
      } catch (err) {
        console.error('Ghost sweep error', err);
      }
    }, 15000);

    return () => {
      supabase.removeChannel(sub);
      clearInterval(ghostSweepInterval);
    };
  }, [sosId]);

  const confirmDonated = async (dispatchId: string) => {
    try {
      const res = await fetch('/api/dispatch/donated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatch_id: dispatchId })
      });
      const json = await res.json();
      if (json.ok) {
        setEvents(prev => [`Donation confirmed! +${json.data.points_awarded} pts.`, ...prev].slice(0, 10));
        fetchDispatches();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Loading dispatches...</div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <h2 className="text-xl font-bold mb-4">Live Dispatch Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700">Donors ({dispatches.length})</h3>
          {dispatches.length === 0 ? (
            <p className="text-sm text-gray-500">No active dispatches.</p>
          ) : (
            dispatches.map(d => (
              <div key={d.id} className="border rounded-md p-3 relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium">{d.donor_name}</span>
                    <span className="ml-2 text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold">
                      {d.donor_blood_group}
                    </span>
                  </div>
                  <div>
                    <span className={`text-xs px-2 py-1 rounded-full text-white ${d.status === 'en_route' ? (d.ghost_risk ? 'bg-amber-500' : 'bg-green-500') : d.status === 'arrived' ? 'bg-blue-500' : d.status === 'ghosted' ? 'bg-red-500' : d.status === 'donated' ? 'bg-purple-500' : 'bg-gray-500'}`}>
                      {d.status === 'en_route' && d.ghost_risk ? 'Delayed' : d.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                
                {d.status === 'en_route' && (
                  <div className="text-sm text-gray-600">
                    ETA: <span className="font-bold text-gray-900">{d.eta_minutes || '?'} min</span>
                  </div>
                )}

                {d.status === 'arrived' && (
                  <button 
                    onClick={() => confirmDonated(d.id)}
                    className="mt-2 w-full bg-red-600 text-white text-sm py-1.5 rounded hover:bg-red-700"
                  >
                    Confirm Donated
                  </button>
                )}
                
                {d.status === 'en_route' && (
                  <div className="w-full bg-gray-200 h-1.5 rounded-full mt-3">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '40%' }}></div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        <div className="bg-gray-50 p-3 rounded border">
          <h3 className="font-semibold text-gray-700 mb-2">Event Timeline</h3>
          <ul className="space-y-2 text-sm">
            {events.length === 0 ? (
              <li className="text-gray-400 italic">Waiting for events...</li>
            ) : (
              events.map((ev, idx) => (
                <li key={idx} className="text-gray-700 border-l-2 border-red-500 pl-2 py-1">
                  {ev}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
