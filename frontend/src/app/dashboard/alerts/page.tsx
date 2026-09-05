import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AlertsView from "@/components/dashboard/AlertsView";
import styles from "./alerts.module.css";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams?: Promise<{ demo?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const isDemoMode = params.demo === "true" || cookieStore.get("setu_demo")?.value === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isDemoMode) {
    redirect("/login");
  }

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("*, districts(name)")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const role = profile?.role || (isDemoMode ? "official" : "reporter");
  const email = user?.email || (isDemoMode ? "official@mdoner.gov.in" : "demo@setu.ner");

  return (
    <main className={styles.container}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <a href="/dashboard" className={styles.brand}>
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#0A6847" />
              <path
                d="M10 25 L20 12 L30 25 M15 22 L20 15 L25 22"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            <div className={styles.brandTitleCol}>
              <span className={styles.brandName}>Setu</span>
              <span className={styles.brandSubtitle}>MDoNER Logistics Intelligence</span>
            </div>
          </a>

          <nav className={styles.nav}>
            <a href="/dashboard" className={styles.navLink}>
              🗺️ GIS Risk Map
            </a>
            <a href="/dashboard/reports" className={styles.navLink}>
              📋 Reports
            </a>
            <a href="/dashboard/alerts" className={styles.navLink} data-active="true">
              🔔 Alerts
            </a>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "12px",
                fontSize: "0.7rem",
                fontWeight: 700,
                background: "rgba(10, 104, 71, 0.1)",
                color: "#0A6847",
                border: "1px solid rgba(10, 104, 71, 0.25)",
              }}
            >
              {role.toUpperCase()}
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
              {email}
            </span>
          </div>
        </div>
      </header>

      <AlertsView />
    </main>
  );
}
