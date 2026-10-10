// Dispatch Donated API
// Feature: Dispatch - Hospital confirms donation, award points, badge evaluation

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ApiResponse, DispatchActionBody } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body: DispatchActionBody = await req.json();
    const { dispatch_id } = body;

    if (!dispatch_id) {
      return NextResponse.json({ ok: false, error: 'Missing dispatch_id' }, { status: 400 });
    }

    // Get dispatch and sos
    const { data: dispatch, error: dispErr } = await supabaseAdmin
      .from('dispatches')
      .select('*, sos_requests(urgency, units_needed, units_fulfilled)')
      .eq('id', dispatch_id)
      .single();
      
    if (dispErr) throw dispErr;
    if (!dispatch) throw new Error('Dispatch not found');

    const isCritical = dispatch.sos_requests.urgency === 'critical';
    const pointsToAward = 50 + (isCritical ? 25 : 0);

    // Update dispatch status
    await supabaseAdmin
      .from('dispatches')
      .update({ status: 'donated', updated_at: new Date().toISOString() })
      .eq('id', dispatch_id);

    // Award points
    await supabaseAdmin.from('rewards_ledger').insert({
      donor_id: dispatch.donor_id,
      points: pointsToAward,
      reason: `Confirmed donation${isCritical ? ' (Critical Bonus)' : ''}`,
      sos_id: dispatch.sos_id,
    });
    
    // Update donor stats
    await supabaseAdmin.rpc('increment_hero_points', { donor_id_param: dispatch.donor_id, pts: pointsToAward });
    
    const now = new Date().toISOString();
    await supabaseAdmin.from('donors')
      .update({ last_donated_at: now })
      .eq('id', dispatch.donor_id);
    await supabaseAdmin.rpc('increment_donations', { donor_id_param: dispatch.donor_id });
      
    // Update SOS fulfilled units
    const { data: updatedSos, error: sosErr } = await supabaseAdmin
      .from('sos_requests')
      .update({ units_fulfilled: dispatch.sos_requests.units_fulfilled + 1 })
      .eq('id', dispatch.sos_id)
      .select('units_needed, units_fulfilled')
      .single();
      
    if (!sosErr && updatedSos && updatedSos.units_fulfilled >= updatedSos.units_needed) {
      await supabaseAdmin.from('sos_requests').update({ status: 'fulfilled' }).eq('id', dispatch.sos_id);
    }
    
    // Call badge evaluation (simulated simple approach)
    // We would evaluate 'life_saver', 'hero', etc. here.
    
    return NextResponse.json({
      ok: true,
      data: {
        dispatch_id: dispatch.id,
        status: 'donated',
        points_awarded: pointsToAward
      }
    });
  } catch (error: any) {
    console.error('donated error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
