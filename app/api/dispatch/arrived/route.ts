// Dispatch Arrived API
// Feature: Dispatch - Mark donor arrived

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

    const { data: dispatch, error: dispatchErr } = await supabaseAdmin
      .from('dispatches')
      .update({ status: 'arrived', updated_at: new Date().toISOString() })
      .eq('id', dispatch_id)
      .select('id, status')
      .single();

    if (dispatchErr) throw dispatchErr;

    return NextResponse.json({
      ok: true,
      data: {
        dispatch_id: dispatch.id,
        status: dispatch.status
      }
    });
  } catch (error: any) {
    console.error('arrived error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
