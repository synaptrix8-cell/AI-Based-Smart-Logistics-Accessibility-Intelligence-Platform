/**
 * Supabase Browser Client
 * 
 * Used in Client Components (anything with "use client").
 * Creates a singleton Supabase client for the browser session.
 * Uses the ANON key — all queries are subject to RLS policies.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
