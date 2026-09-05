"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole, User } from "@/lib/types/database";

interface RoleGuardProps {
  /** Roles that are allowed to see this content */
  allowedRoles: UserRole[];
  /** Content to render when authorized */
  children: ReactNode;
  /** Content to render when unauthorized (optional — defaults to null) */
  fallback?: ReactNode;
  /** Content to render while loading */
  loading?: ReactNode;
}

/**
 * Client-side role guard component.
 * 
 * IMPORTANT: This is a UI convenience — actual access control is enforced
 * server-side via RLS policies. This just prevents rendering content that
 * the user doesn't have access to, avoiding confusing empty states.
 */
export default function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
  loading: loadingContent = null,
}: RoleGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchUserRole() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      setUser(profile);
      setIsLoading(false);
    }

    fetchUserRole();
  }, []);

  if (isLoading) {
    return <>{loadingContent}</>;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
