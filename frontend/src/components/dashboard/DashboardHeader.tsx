"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./DashboardHeader.module.css";

interface DashboardHeaderProps {
  role?: string;
  email?: string;
  isLoggedIn?: boolean;
}

export default function DashboardHeader({
  role = "OFFICIAL",
  email = "demo@setu.ner",
  isLoggedIn = false,
}: DashboardHeaderProps) {
  const pathname = usePathname() || "/dashboard";

  const isRiskMapActive = pathname === "/dashboard";
  const isReportsActive = pathname.startsWith("/dashboard/reports");
  const isAlertsActive = pathname.startsWith("/dashboard/alerts");

  return (
    <header className={styles.topBar}>
      <div className={styles.topBarInner}>
        {/* Brand */}
        <Link href="/dashboard" className={styles.brand}>
          <svg className={styles.brandLogo} viewBox="0 0 40 40" fill="none">
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
        </Link>

        {/* Consistent Center Navigation */}
        <nav className={styles.nav} aria-label="Dashboard Navigation">
          <Link
            href="/dashboard"
            className={styles.navLink}
            data-active={isRiskMapActive ? "true" : undefined}
          >
            🗺️ GIS Risk Map
          </Link>
          <Link
            href="/dashboard/reports"
            className={styles.navLink}
            data-active={isReportsActive ? "true" : undefined}
          >
            📋 Reports
          </Link>
          <Link
            href="/dashboard/alerts"
            className={styles.navLink}
            data-active={isAlertsActive ? "true" : undefined}
          >
            🔔 Alerts
          </Link>
        </nav>

        {/* User Info & Actions */}
        <div className={styles.userInfo}>
          <span className={styles.roleBadge}>
            {role.toUpperCase()}
          </span>
          <span className={styles.userEmail} title={email}>
            {email}
          </span>
          {isLoggedIn ? (
            <form action="/auth/signout" method="POST">
              <button type="submit" className={styles.actionBtn}>
                Log Out
              </button>
            </form>
          ) : (
            <a href="/login" className={styles.actionBtn}>
              Exit Demo
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
