// Dispatch Ghost Sweep API
// Feature: Dispatch - Anti-ghosting job

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const GHOST_WINDOW_MIN = Number(process.env.DEMO_GHOST_WINDOW_MIN || process.env.GHOST_WINDOW_MIN || 10);
    const ghostThresholdMs = GHOST_WINDOW_MIN * 60 * 1000;
    const now = Date.now();
    
    // Find dispatches en_route, started_moving_at IS NULL
    const { data: dispatches, error } = await supabaseAdmin
      .from('dispatches')
      .select('id, donor_id, sos_id, accepted_at')
      .eq('status', 'en_route')
      .is('started_moving_at', null);

    if (error) throw error;

    const ghosts = dispatches.filter(d => {
      const acceptedMs = new Date(d.accepted_at).getTime();
      return (now - acceptedMs) > ghostThresholdMs;
    });

    if (ghosts.length === 0) {
      return NextResponse.json({ ok: true, data: { ghosts_found: 0, replacements_notified: 0, details: [] } });
    }

    const details = [];

    for (const ghost of ghosts) {
      // 1. Mark ghosted
      await supabaseAdmin.from('dispatches').update({ status: 'ghosted', updated_at: new Date().toISOString() }).eq('id', ghost.id);
      
      // 2. Penalize donor
      await supabaseAdmin.from('rewards_ledger').insert({
        donor_id: ghost.donor_id,
        points: -10,
        reason: 'Ghosted dispatch',
        sos_id: ghost.sos_id,
      });
      await supabaseAdmin.rpc('increment_hero_points', { donor_id_param: ghost.donor_id, pts: -10 });
      await supabaseAdmin.rpc('increment_ghost_count', { donor_id_param: ghost.donor_id });
      
      // 3. Log event (optional, handled by UI if needed, or simple table insert)
      
      // 4. Mock notification replacement (Person 1 owns matching, we mock contract)
      // Call notifyNextDonors via API or internal RPC if available. For this MVP we just mock the result.
      
      details.push({
        dispatch_id: ghost.id,
        donor_id: ghost.donor_id,
        sos_id: ghost.sos_id,
        replacement_donor_id: 'mock-uuid-if-needed'
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        ghosts_found: ghosts.length,
        replacements_notified: ghosts.length, // mocked
        details
      }
    });
  } catch (error: any) {
    console.error('ghost-sweep error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
