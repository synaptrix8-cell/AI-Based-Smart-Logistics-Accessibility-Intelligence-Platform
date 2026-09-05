import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import LiveDashboardView from "@/components/dashboard/LiveDashboardView";
import styles from "./dashboard.module.css";

export default async function DashboardPage({
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

  // Fetch user profile with role if logged in
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
    <main className={styles.dashboard}>
      {/* Top navigation bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.brand}>
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
          </div>

          <nav className={styles.nav}>
            <a href="/dashboard" className={styles.navLink} data-active="true">
              🗺️ GIS Risk Map
            </a>
            <a href="/dashboard/reports" className={styles.navLink}>
              📋 Reports
            </a>
            <a href="/dashboard/alerts" className={styles.navLink}>
              🔔 Alerts
            </a>
          </nav>

          <div className={styles.userInfo}>
            <span
              className={`badge ${
                role === "admin"
                  ? "badge-info"
                  : role === "official"
                  ? "badge-success"
                  : role === "driver"
                  ? "badge-warning"
                  : "badge-info"
              }`}
            >
              {role.toUpperCase()}
            </span>
            <span className={styles.userEmail}>{email}</span>
            {user ? (
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ padding: "4px 12px", fontSize: "0.75rem" }}
                >
                  Log Out
                </button>
              </form>
            ) : (
              <a
                href="/login"
                className="btn btn-primary"
                style={{ padding: "4px 12px", fontSize: "0.75rem" }}
              >
                Sign In
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className={styles.content}>
        {/* KPI Stats overview */}
        <div className={styles.statsGrid}>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statIcon}>🗺️</div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>17</span>
              <span className={styles.statLabel}>Monitored Corridors</span>
            </div>
          </div>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statIcon}>⚠️</div>
            <div className={styles.statContent}>
              <span className={styles.statValue} style={{ color: "var(--risk-high)" }}>
                3
              </span>
              <span className={styles.statLabel}>High Hazard Zones</span>
            </div>
          </div>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statIcon}>🌦️</div>
            <div className={styles.statContent}>
              <span className={styles.statValue}>4</span>
              <span className={styles.statLabel}>Active Weather Feeds</span>
            </div>
          </div>
          <div className={`card ${styles.statCard}`}>
            <div className={styles.statIcon}>🛡️</div>
            <div className={styles.statContent}>
              <span className={styles.statValue} style={{ color: "var(--color-primary-light)" }}>
                Online
              </span>
              <span className={styles.statLabel}>Dijkstra Safe Routing</span>
            </div>
          </div>
        </div>

        {/* Phase 2: Live GIS Map + AI Safe Route Planner */}
        <div className={styles.mapSection}>
          <LiveDashboardView />
        </div>
      </div>
    </main>
  );
}
