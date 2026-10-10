// Rewards Redeem API
// Feature: Rewards - Deduct points, return coupon

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { RedeemCouponBody } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body: RedeemCouponBody = await req.json();
    const { donor_id, coupon_id } = body;

    if (!donor_id || !coupon_id) {
      return NextResponse.json({ ok: false, error: 'Missing donor_id or coupon_id' }, { status: 400 });
    }

    // Get donor points and coupon cost
    const [{ data: donor }, { data: coupon }] = await Promise.all([
      supabaseAdmin.from('donors').select('hero_points').eq('id', donor_id).single(),
      supabaseAdmin.from('coupons').select('points_cost, code').eq('id', coupon_id).single()
    ]);

    if (!donor || !coupon) {
      return NextResponse.json({ ok: false, error: 'Donor or coupon not found' }, { status: 404 });
    }

    if (donor.hero_points < coupon.points_cost) {
      return NextResponse.json({ ok: false, error: 'Insufficient points' }, { status: 400 });
    }

    // Deduct points
    await supabaseAdmin.from('rewards_ledger').insert({
      donor_id,
      points: -coupon.points_cost,
      reason: 'Redeemed coupon',
      sos_id: null,
    });
    
    await supabaseAdmin.rpc('increment_hero_points', { donor_id_param: donor_id, pts: -coupon.points_cost });

    return NextResponse.json({
      ok: true,
      data: {
        coupon_code: coupon.code,
        points_spent: coupon.points_cost,
        remaining_points: donor.hero_points - coupon.points_cost
      }
    });
  } catch (error: any) {
    console.error('redeem error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
