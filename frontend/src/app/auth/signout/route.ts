/**
 * Sign Out Route Handler
 * 
 * Signs the user out of Supabase Auth and redirects to the landing page.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/`, { status: 302 });
  response.cookies.delete("setu_demo");
  return response;
}
