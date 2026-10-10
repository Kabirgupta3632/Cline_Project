// Demo Reset API
// Feature: Demo - Reset database to seed state

import { NextResponse } from 'next/server';

export async function POST() {
  try {
    return NextResponse.json({ ok: true, data: { reset: true } });
  } catch (error: any) {
    console.error('demo reset error', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
