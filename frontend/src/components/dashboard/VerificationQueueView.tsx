"use client";

import { useState, useEffect } from "react";
import { decryptPayload } from "@/lib/crypto";
import { QueuedReport, getPendingReports } from "@/lib/offline-queue";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/dashboard/reports/reports.module.css";

interface IncidentItem {
  id: string;
  category: "landslide" | "flood" | "road_damage" | "congestion" | "other";
  corridor_name: string;
  segment_id?: string;
  lat: number;
  lng: number;
  severity: number;
  description: string;
  encrypted_payload?: string;
  iv?: string;
  status: "unverified" | "verified" | "rejected";
  created_at: string;
  decrypted?: boolean;
}

const INITIAL_DEMO_REPORTS: IncidentItem[] = [
  {
    id: "rep-ekh-001",
    category: "landslide",
    corridor_name: "Cherrapunji Gorgeside Pass (SH-5 South)",
    segment_id: "seg-ekh-007",
    lat: 25.2891,
    lng: 91.7102,
    severity: 4,
    description: "Active mudslide debris covering entire downhill lane. Heavy rain continuing (38 mm/hr). Boulders detached above cliff.",
    encrypted_payload: "Encrypted AES-GCM Payload (Citizen Phone & Identity Hash)",
    iv: "iv_gorgeside_96bit",
    status: "unverified",
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: "rep-ekh-002",
    category: "other",
    corridor_name: "Pynursla-Dawki Border Highway (NH-206)",
    segment_id: "seg-ekh-011",
    lat: 25.2104,
    lng: 91.9541,
    severity: 3,
    description: "Partial rockfall chute blocking northbound freight traffic. Light vehicles navigating via shoulder.",
    encrypted_payload: "Encrypted AES-GCM Payload",
    iv: "iv_dawki_96bit",
    status: "unverified",
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: "rep-ekh-003",
    category: "flood",
    corridor_name: "Upper Shillong-Mawphlang Arterial (SH-5)",
    segment_id: "seg-ekh-005",
    lat: 25.4601,
    lng: 91.7612,
    severity: 2,
    description: "Culvert overflow waterlogging road surface for 200m. Passable for trucks, slow for smaller transport.",
    status: "verified",
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
];

export default function VerificationQueueView({
  isDemo = false,
}: {
  isDemo?: boolean;
}) {
  const [reports, setReports] = useState<IncidentItem[]>(INITIAL_DEMO_REPORTS);
  const [filter, setFilter] = useState<"all" | "unverified" | "verified" | "rejected">("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadReports() {
      // 1. Load pending reports from offline IndexedDB queue
      try {
        const offline = await getPendingReports();
        if (offline.length > 0) {
          const mapped: IncidentItem[] = offline.map((r) => ({
            id: r.id,
            category: r.category,
            corridor_name: r.corridor_name || "East Khasi Hills Corridor",
            segment_id: r.segment_id,
            lat: r.lat,
            lng: r.lng,
            severity: r.severity,
            description: r.description,
            encrypted_payload: r.encrypted_payload,
            iv: r.iv,
            status: "unverified",
            created_at: r.created_at,
          }));

          setReports((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const fresh = mapped.filter((m) => !existingIds.has(m.id));
            return [...fresh, ...prev];
          });
        }
      } catch (err) {
        console.warn("Could not check offline IndexedDB queue:", err);
      }

      // 2. If not demo, try fetching real reports from Supabase
      if (!isDemo) {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from("reports")
            .select("*, road_segments(name)")
            .order("created_at", { ascending: false })
            .limit(20);

          if (data && data.length > 0) {
            const mapped: IncidentItem[] = data.map((r: any) => ({
              id: r.id,
              category: r.category,
              corridor_name: r.road_segments?.name || "Monitored Corridor",
              segment_id: r.segment_id,
              lat: r.lat,
              lng: r.lng,
              severity: r.severity || 3,
              description: r.encrypted_payload || "Field incident reported",
              encrypted_payload: r.encrypted_payload,
              iv: r.iv,
              status: r.status,
              created_at: r.created_at,
            }));
            setReports(mapped);
          }
        } catch (err) {
          console.warn("Supabase reports query error:", err);
        }
      }
    }

    loadReports();
  }, [isDemo]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function handleVerify(id: string) {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "verified" as const } : r))
    );

    if (!isDemo) {
      try {
        const supabase = createClient();
        await supabase
          .from("reports")
          .update({ status: "verified" })
          .eq("id", id);
      } catch (err) {
        console.warn("Verification update error:", err);
      }
    }

    showToast("✅ Incident marked VERIFIED. Corridor hazard status elevated across network!");
  }

  async function handleReject(id: string) {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "rejected" as const } : r))
    );

    if (!isDemo) {
      try {
        const supabase = createClient();
        await supabase
          .from("reports")
          .update({ status: "rejected" })
          .eq("id", id);
      } catch (err) {
        console.warn("Reject update error:", err);
      }
    }

    showToast("❌ Incident marked REJECTED. Dismissed from active risk queue.");
  }

  async function handleDecrypt(id: string) {
    const item = reports.find((r) => r.id === id);
    if (!item || !item.encrypted_payload || !item.iv) return;

    const result = await decryptPayload<{ description?: string; reporter_note?: string }>(
      item.encrypted_payload,
      item.iv
    );

    if (result && result.description) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                description: `${result.description} [Verified Note: ${result.reporter_note || "Authenticated Reporter"}]`,
                decrypted: true,
              }
            : r
        )
      );
      showToast("🔓 AES-GCM Payload decrypted successfully using Official Key.");
    } else {
      showToast("ℹ️ Payload already verified in plain text.");
    }
  }

  const filteredReports = reports.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const unverifiedCount = reports.filter((r) => r.status === "unverified").length;

  return (
    <div className={styles.content}>
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#0f241a",
            border: "1px solid #10b981",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            zIndex: 9999,
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {toastMessage}
        </div>
      )}

      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.pageHeading}>
            <span>📋</span> Incident Verification Queue
          </h1>
          <p className={styles.pageDesc}>
            District Control Room • Official Field Report Triage & Validation Console
          </p>
        </div>

        <div className={styles.filtersBar}>
          <button
            className={styles.filterBtn}
            data-active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All Reports ({reports.length})
          </button>
          <button
            className={styles.filterBtn}
            data-active={filter === "unverified"}
            onClick={() => setFilter("unverified")}
          >
            ⚠️ Pending Review ({unverifiedCount})
          </button>
          <button
            className={styles.filterBtn}
            data-active={filter === "verified"}
            onClick={() => setFilter("verified")}
          >
            ✅ Verified ({reports.filter((r) => r.status === "verified").length})
          </button>
          <button
            className={styles.filterBtn}
            data-active={filter === "rejected"}
            onClick={() => setFilter("rejected")}
          >
            Dismissed ({reports.filter((r) => r.status === "rejected").length})
          </button>
        </div>
      </div>

      <div className={styles.reportsGrid}>
        {filteredReports.length === 0 ? (
          <div className={styles.emptyState}>
            <span>🛡️</span>
            <p>No reports currently matching the filter &quot;{filter}&quot;.</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div key={report.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardMeta}>
                  <span className={styles.corridorTitle}>
                    {report.category === "landslide"
                      ? "⛰️ Landslide"
                      : report.category === "flood"
                      ? "🌊 Waterlogging"
                      : report.category === "road_damage"
                      ? "🚧 Road Damage"
                      : "⚠️ Hazard Alert"}
                  </span>
                  <span className={styles.timeTag}>
                    {report.corridor_name} • {new Date(report.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <span
                  className={`${styles.badge} ${
                    report.status === "verified"
                      ? styles.badgeVerified
                      : report.status === "rejected"
                      ? styles.badgeRejected
                      : styles.badgeUnverified
                  }`}
                >
                  {report.status.toUpperCase()}
                </span>
              </div>

              <div className={styles.descriptionBox}>
                <p style={{ margin: 0 }}>{report.description}</p>
                {report.encrypted_payload && !report.decrypted && (
                  <button
                    onClick={() => handleDecrypt(report.id)}
                    style={{
                      marginTop: "8px",
                      background: "rgba(16,185,129,0.15)",
                      border: "1px solid rgba(16,185,129,0.4)",
                      color: "#a7f3d0",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>🔒</span> Decrypt Field Payload
                  </button>
                )}
              </div>

              <div className={styles.statsRow}>
                <div className={styles.gpsTag}>
                  <span>📍</span> {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
                </div>
                <div>
                  Severity:{" "}
                  <strong
                    style={{
                      color:
                        report.severity >= 4
                          ? "#ef4444"
                          : report.severity === 3
                          ? "#f59e0b"
                          : "#10b981",
                    }}
                  >
                    Level {report.severity}/5
                  </strong>
                </div>
              </div>

              <div className={styles.actionsRow}>
                {report.status === "unverified" ? (
                  <>
                    <button
                      className={styles.verifyBtn}
                      onClick={() => handleVerify(report.id)}
                    >
                      <span>✓</span> Verify Hazard
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => handleReject(report.id)}
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <button
                    disabled
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "8px",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: "0.8rem",
                      cursor: "default",
                    }}
                  >
                    Status Locked: {report.status.toUpperCase()}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
