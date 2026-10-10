// Supabase client factory – browser (anon) and server (service-role)
// Feature: Infrastructure – imported by all API routes and client components

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Browser / client-component client (anon key, RLS enforced).
 * Safe to import in 'use client' files.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-side admin client (service-role key, bypasses RLS).
 * Import ONLY inside app/api/** route handlers – never expose to browser.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
