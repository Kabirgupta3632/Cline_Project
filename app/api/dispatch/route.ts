// Dispatch List API
// Feature: Dispatch - Live list of dispatches for an SOS

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ApiResponse, DispatchWithDonor } from '@/lib/types';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sos_id = searchParams.get('sos_id');

    if (!sos_id) {
      return NextResponse.json({ ok: false, error: 'Missing sos_id' }, { status: 400 });
    }

    const { data: dispatches, error } = await supabaseAdmin
      .from('dispatches')
      .select(`
        *,
        donors (
          name,
          blood_group,
          ghost_count
        )
      `)
      .eq('sos_id', sos_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to DispatchWithDonor shape and compute minutes_since_accept / ghost_risk
    const now = Date.now();
    const result = dispatches.map(d => {
      const acceptedMs = new Date(d.accepted_at).getTime();
      const minsSinceAccept = Math.floor((now - acceptedMs) / 60000);
      
      return {
        ...d,
        donor_name: d.donors?.name || 'Unknown',
        donor_blood_group: d.donors?.blood_group || 'Unknown',
        minutes_since_accept: minsSinceAccept,
        ghost_risk: d.donors?.ghost_count > 0 || (d.status === 'en_route' && !d.started_moving_at && minsSinceAccept > 3)
      };
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    console.error('dispatch list error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
