// Demo Time-warp API
// Feature: Demo - Advance virtual time for testing ghosting

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { advance_minutes } = await req.json();

    if (!advance_minutes) {
      return NextResponse.json({ ok: false, error: 'Missing advance_minutes' }, { status: 400 });
    }
    
    const { data: dispatches } = await supabaseAdmin.from('dispatches').select('id, accepted_at').eq('status', 'en_route');
    
    if (dispatches) {
      for (const d of dispatches) {
        const date = new Date(d.accepted_at);
        date.setMinutes(date.getMinutes() - advance_minutes);
        await supabaseAdmin.from('dispatches').update({ accepted_at: date.toISOString() }).eq('id', d.id);
      }
    }

    return NextResponse.json({ ok: true, data: { warped_minutes: advance_minutes } });
  } catch (error: any) {
    console.error('time-warp error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
