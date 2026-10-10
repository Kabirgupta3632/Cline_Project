// Dispatch Cancel API
// Feature: Dispatch - Cancel a dispatch, deduct points

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

    // Update dispatch status
    const { data: dispatch, error: dispatchErr } = await supabaseAdmin
      .from('dispatches')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', dispatch_id)
      .select('id, status, donor_id, sos_id')
      .single();

    if (dispatchErr) throw dispatchErr;

    // Deduct 10 points
    await supabaseAdmin.from('rewards_ledger').insert({
      donor_id: dispatch.donor_id,
      points: -10,
      reason: 'Cancelled dispatch',
      sos_id: dispatch.sos_id,
    });
    
    await supabaseAdmin.rpc('increment_hero_points', { donor_id_param: dispatch.donor_id, pts: -10 });
    
    // NOTE: Replacement logic is handled via ghost-sweep or escalate in a real flow, 
    // but we can mock a call here if needed by the contract.

    return NextResponse.json({
      ok: true,
      data: {
        dispatch_id: dispatch.id,
        status: dispatch.status
      }
    });
  } catch (error: any) {
    console.error('cancel error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
