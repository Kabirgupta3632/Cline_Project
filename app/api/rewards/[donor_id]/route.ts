// Rewards Get API
// Feature: Rewards - Get donor points, badges, ledger, coupons

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request, { params }: { params: { donor_id: string } }) {
  try {
    const donor_id = params.donor_id;

    const [donorRes, badgesRes, ledgerRes, couponsRes] = await Promise.all([
      supabaseAdmin.from('donors').select('hero_points').eq('id', donor_id).single(),
      supabaseAdmin.from('badges').select('*').eq('donor_id', donor_id),
      supabaseAdmin.from('rewards_ledger').select('*').eq('donor_id', donor_id).order('created_at', { ascending: false }),
      supabaseAdmin.from('coupons').select('*') // All coupons available
    ]);

    if (donorRes.error) throw donorRes.error;

    return NextResponse.json({
      ok: true,
      data: {
        donor_id,
        hero_points: donorRes.data.hero_points,
        badges: badgesRes.data || [],
        ledger: ledgerRes.data || [],
        available_coupons: couponsRes.data || []
      }
    });
  } catch (error: any) {
    console.error('rewards get error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
