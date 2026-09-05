/**
 * Next.js Middleware
 * 
 * Runs on every request. Handles:
 * 1. Session refresh (JWT rotation)
 * 2. Route protection (redirect to /login if unauthenticated)
 * 3. Auth route guarding (redirect to /dashboard if already logged in)
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, icons, etc.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
