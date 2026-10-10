// Demo Control Panel
// Feature: Demo - Simulator UI for pitch recording

'use client';

import { useState } from 'react';

export default function DemoPage() {
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [msg, ...prev].slice(0, 5));

  const runAction = async (name: string, url: string, body?: any) => {
    try {
      addLog(`Running: ${name}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const json = await res.json();
      if (json.ok) {
        addLog(`Success: ${name}`);
      } else {
        addLog(`Error: ${json.error}`);
      }
    } catch (err: any) {
      addLog(`Failed: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col md:flex-row gap-6">
      
      {/* Control Panel Sidebar */}
      <div className="w-full md:w-1/4 bg-white p-4 rounded-lg shadow-sm border space-y-4">
        <h1 className="text-2xl font-bold text-red-600 mb-6">Demo Controls</h1>
        
        <div className="space-y-2">
          <button onClick={() => runAction('Reset DB', '/api/demo/reset')} className="w-full bg-gray-200 hover:bg-gray-300 py-2 rounded text-sm font-medium">
            Reset Demo Data
          </button>
          <button onClick={() => runAction('Simulate Critical SOS', '/api/sos', { urgency: 'critical', blood_group: 'O-', units_needed: 3, hospital_id: '123' })} className="w-full bg-red-100 text-red-700 hover:bg-red-200 py-2 rounded text-sm font-medium">
            Create Critical SOS
          </button>
          <button onClick={() => runAction('Time Warp (Ghost)', '/api/demo/time-warp', { advance_minutes: 11 })} className="w-full bg-purple-100 text-purple-700 hover:bg-purple-200 py-2 rounded text-sm font-medium">
            Simulate Ghosting (+11m)
          </button>
          <button onClick={() => runAction('Ghost Sweep Now', '/api/dispatch/ghost-sweep')} className="w-full bg-amber-100 text-amber-700 hover:bg-amber-200 py-2 rounded text-sm font-medium">
            Run Ghost Sweep
          </button>
          <button onClick={() => runAction('Add 100 Points', '/api/demo/add-points')} className="w-full bg-green-100 text-green-700 hover:bg-green-200 py-2 rounded text-sm font-medium">
            Add 100 Hero Points
          </button>
        </div>

        <div className="mt-8 bg-black text-green-400 p-3 rounded font-mono text-xs h-40 overflow-y-auto">
          {log.map((l, i) => <div key={i}>&gt; {l}</div>)}
          {log.length === 0 && <div>Ready.</div>}
        </div>
      </div>

      {/* Split Screen Views */}
      <div className="w-full md:w-3/4 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Hospital View Mock */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden border">
          <div className="bg-slate-800 text-white p-3 text-sm font-semibold flex justify-between">
            <span>City Hospital Dashboard</span>
            <span className="text-slate-400">Desktop View</span>
          </div>
          <div className="p-4 h-[600px] bg-slate-50">
            {/* The Dispatch Panel would go here. We render a placeholder as we don't have a real SOS id yet */}
            <div className="p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500 mt-10">
              <p>Hospital Dashboard Content</p>
              <p className="text-xs mt-2">Will mount DispatchPanel when SOS is active.</p>
            </div>
          </div>
        </div>

        {/* Donor Mobile Frame */}
        <div className="flex justify-center">
          <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border-8 border-gray-900 w-[320px] h-[650px] relative">
            <div className="absolute top-0 w-full h-6 bg-gray-900 flex justify-center">
              <div className="w-32 h-4 bg-black rounded-b-xl"></div>
            </div>
            <div className="bg-red-600 text-white p-4 pt-8 text-center font-bold">
              RakshaRakt Donor
            </div>
            <div className="p-4 bg-gray-50 h-full">
               <div className="p-4 border rounded-xl bg-white shadow-sm text-center mt-4">
                 <h3 className="font-bold text-red-600 mb-1">Critical SOS Nearby</h3>
                 <p className="text-xs text-gray-500 mb-4">City Hospital needs 3 units of O-</p>
                 <div className="flex gap-2">
                   <button className="flex-1 bg-gray-200 py-2 rounded-lg text-sm font-medium">Decline</button>
                   <button className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium">Accept (ETA 8m)</button>
                 </div>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
