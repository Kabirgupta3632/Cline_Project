// Dispatch Ping API
// Feature: Dispatch - Update donor location, compute ETA

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { haversineKm, etaMinutes, isStationary } from '@/lib/geo';
import { ApiResponse, DonorLocationBody } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body: DonorLocationBody = await req.json();
    const { donor_id, lat, lng } = body;

    if (!donor_id || lat === undefined || lng === undefined) {
      return NextResponse.json({ ok: false, error: 'Missing donor_id, lat, or lng' }, { status: 400 });
    }

    // Find active dispatch
    const { data: dispatch, error: dispErr } = await supabaseAdmin
      .from('dispatches')
      .select('id, sos_id, last_lat, last_lng, started_moving_at')
      .eq('donor_id', donor_id)
      .eq('status', 'en_route')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dispErr || !dispatch) {
      return NextResponse.json({ ok: false, error: 'No active dispatch found' }, { status: 404 });
    }

    // Get hospital location
    const { data: sosRes, error: sosErr } = await supabaseAdmin
      .from('sos_requests')
      .select('hospitals(ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng)')
      .eq('id', dispatch.sos_id)
      .single();
      
    if (sosErr || !sosRes || !sosRes.hospitals) {
      return NextResponse.json({ ok: false, error: 'SOS/Hospital not found' }, { status: 404 });
    }

    // @ts-ignore
    const hosp = Array.isArray(sosRes.hospitals) ? sosRes.hospitals[0] : sosRes.hospitals;
    const hospLoc = { lat: hosp.lat, lng: hosp.lng };
    const currentLoc = { lat, lng };

    const distance = haversineKm(currentLoc, hospLoc);
    const eta = etaMinutes(distance);

    // Update dispatch logic
    let started_moving_at = dispatch.started_moving_at;
    
    if (!started_moving_at && dispatch.last_lat && dispatch.last_lng) {
      const lastLoc = { lat: dispatch.last_lat, lng: dispatch.last_lng };
      if (!isStationary(lastLoc, currentLoc)) {
        started_moving_at = new Date().toISOString();
      }
    } else if (!started_moving_at && (!dispatch.last_lat || !dispatch.last_lng)) {
      // First ping could be considered moving if it differs from donor home (but we don't fetch home here).
      // We'll leave it null until second ping to be safe, or set it if we assume movement.
      // Let's set it if we assume they are moving on first ping for simplicity in demo.
       started_moving_at = new Date().toISOString();
    }

    await supabaseAdmin
      .from('dispatches')
      .update({
        last_lat: lat,
        last_lng: lng,
        eta_minutes: eta,
        started_moving_at,
        updated_at: new Date().toISOString()
      })
      .eq('id', dispatch.id);

    return NextResponse.json({
      ok: true,
      data: {
        dispatch_id: dispatch.id,
        eta_minutes: eta
      }
    });
  } catch (error: any) {
    console.error('ping error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
