// Dispatch En-route API
// Feature: Dispatch - Mark donor en route, compute ETA, award points

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { haversineKm, etaMinutes } from '@/lib/geo';
import { ApiResponse, DispatchActionBody } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body: DispatchActionBody = await req.json();
    const { donor_id, sos_id } = body;

    if (!donor_id || !sos_id) {
      return NextResponse.json({ ok: false, error: 'Missing donor_id or sos_id' }, { status: 400 });
    }

    // Get donor location and hospital location
    const [donorRes, sosRes] = await Promise.all([
      supabaseAdmin.from('donors').select('ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng').eq('id', donor_id).single(),
      supabaseAdmin.from('sos_requests')
        .select('hospital_id, hospitals(ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng)')
        .eq('id', sos_id).single()
    ]);

    let eta = null;
    let distance = null;
    
    if (donorRes.data && sosRes.data && sosRes.data.hospitals) {
      const donorLoc = { lat: donorRes.data.lat, lng: donorRes.data.lng };
      // @ts-ignore (hospitals is array or single depending on relation setup, but single here)
      const hosp = Array.isArray(sosRes.data.hospitals) ? sosRes.data.hospitals[0] : sosRes.data.hospitals;
      const hospLoc = { lat: hosp.lat, lng: hosp.lng };
      
      distance = haversineKm(donorLoc, hospLoc);
      eta = etaMinutes(distance);
    }

    // Create dispatch
    const { data: dispatch, error: dispatchErr } = await supabaseAdmin
      .from('dispatches')
      .insert({
        sos_id,
        donor_id,
        status: 'en_route',
        eta_minutes: eta,
        last_lat: donorRes.data?.lat || null,
        last_lng: donorRes.data?.lng || null,
      })
      .select('id, eta_minutes, status')
      .single();

    if (dispatchErr) throw dispatchErr;

    // Award +10 points for accepting
    await supabaseAdmin.from('rewards_ledger').insert({
      donor_id,
      points: 10,
      reason: 'Responded Yes to SOS',
      sos_id,
    });
    
    await supabaseAdmin.rpc('increment_hero_points', { donor_id_param: donor_id, pts: 10 });

    return NextResponse.json({
      ok: true,
      data: {
        dispatch_id: dispatch.id,
        eta_minutes: dispatch.eta_minutes,
        status: dispatch.status
      }
    });
  } catch (error: any) {
    console.error('en-route error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
