import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import AlertsView from "@/components/dashboard/AlertsView";
import styles from "./alerts.module.css";

export const metadata: Metadata = {
  title: "Alerts",
};

export default async function AlertsPage({
  searchParams,
}: {
  searchParams?: Promise<{ demo?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const isDemoMode = params.demo === "true" || cookieStore.get("setu_demo")?.value === "true";

  let user = null;
  let supabase = null;
  try {
    supabase = await createClient();
    const res = await supabase.auth.getUser();
    user = res?.data?.user ?? null;
  } catch (err) {
    console.warn("Supabase auth check fallback:", err);
    user = null;
  }

  if (!user && !isDemoMode) {
    redirect("/login");
  }

  let profile = null;
  if (user && supabase) {
    try {
      const { data } = await supabase
        .from("users")
        .select("*, districts(name)")
        .eq("id", user.id)
        .single();
      profile = data;
    } catch {
      profile = null;
    }
  }

  const role = profile?.role || (isDemoMode ? "official" : "reporter");
  const email = user?.email || (isDemoMode ? "official@mdoner.gov.in" : "demo@setu.ner");

  return (
    <main className={styles.container}>
      <DashboardHeader role={role} email={email} isLoggedIn={Boolean(user)} />

      <AlertsView />
    </main>
  );
}
