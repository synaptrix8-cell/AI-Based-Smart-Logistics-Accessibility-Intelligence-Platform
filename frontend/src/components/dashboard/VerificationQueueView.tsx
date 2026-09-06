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
    segment_id: "seg-010",
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
    category: "road_damage",
    corridor_name: "Pynursla-Dawki Border Highway (NH-40)",
    segment_id: "seg-013",
    lat: 25.2104,
    lng: 91.9541,
    severity: 3,
    description: "Partial rockfall chute blocking northbound freight traffic. Light vehicles navigating via shoulder.",
    encrypted_payload: "Encrypted AES-GCM Payload (Border Transport Hash)",
    iv: "iv_dawki_96bit",
    status: "unverified",
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: "rep-ekh-003",
    category: "flood",
    corridor_name: "Upper Shillong-Mawphlang Arterial (SH-5)",
    segment_id: "seg-008",
    lat: 25.4601,
    lng: 91.7612,
    severity: 2,
    description: "Culvert overflow waterlogging road surface for 200m. Passable for trucks, slow for smaller transport.",
    status: "verified",
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
];

import {
  markReportVerified,
  getStoredVerifiedReports,
  getStoredClearedCorridors,
  getStoredResolvedIncidents,
} from "@/lib/hazard-sync";

export default function VerificationQueueView({
  isDemo = false,
}: {
  isDemo?: boolean;
}) {
  const [reports, setReports] = useState<IncidentItem[]>(INITIAL_DEMO_REPORTS);
  const [filter, setFilter] = useState<"all" | "unverified" | "verified" | "rejected">("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [clearedCorridorIds, setClearedCorridorIds] = useState<string[]>([]);
  const [resolvedIncidentIds, setResolvedIncidentIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadReports() {
      // 1. Read persistent verification state from localStorage to survive hard refresh
      let verifiedStatusMap = getStoredVerifiedReports();
      setClearedCorridorIds(getStoredClearedCorridors());
      setResolvedIncidentIds(Object.keys(getStoredResolvedIncidents()));

      // 2. Fetch server-side verified reports from API
      try {
        const verifyResp = await fetch("/api/reports/verify");
        if (verifyResp.ok) {
          const vData = await verifyResp.json();
          if (vData.verified_reports && Array.isArray(vData.verified_reports)) {
            vData.verified_reports.forEach((vr: any) => {
              verifiedStatusMap[vr.id] = vr;
            });
          }
        }
      } catch {}

      // 3. Check official clearance state from /api/alerts/resolve
      try {
        const resResp = await fetch("/api/alerts/resolve");
        if (resResp.ok) {
          const rData = await resResp.json();
          if (rData.cleared_corridors) {
            setClearedCorridorIds((prev) => Array.from(new Set([...prev, ...rData.cleared_corridors])));
          }
          if (rData.resolved_ids) {
            setResolvedIncidentIds((prev) => Array.from(new Set([...prev, ...rData.resolved_ids])));
          }
        }
      } catch {}

      // Apply saved statuses to initial reports
      let currentReports = INITIAL_DEMO_REPORTS.map((r) => {
        if (verifiedStatusMap[r.id]) {
          return { ...r, status: verifiedStatusMap[r.id].status as any };
        }
        return r;
      });

      // 4. Load custom submitted reports from localStorage
      try {
        if (typeof window !== "undefined") {
          const rawSubmitted = localStorage.getItem("setu_submitted_reports");
          if (rawSubmitted) {
            const submittedList: any[] = JSON.parse(rawSubmitted);
            const mappedSubmitted: IncidentItem[] = submittedList.map((r) => ({
              id: r.id,
              category: r.category,
              corridor_name: r.corridor_name || r.nearest_landmark || "East Khasi Hills Corridor",
              segment_id: r.segment_id || "seg-002",
              lat: r.lat,
              lng: r.lng,
              severity: r.severity || 3,
              description: r.description || "Field incident reported",
              status: (verifiedStatusMap[r.id]?.status || "unverified") as any,
              created_at: r.created_at,
            }));
            const existingIds = new Set(currentReports.map((p) => p.id));
            const freshSubmitted = mappedSubmitted.filter((m) => !existingIds.has(m.id));
            currentReports = [...freshSubmitted, ...currentReports];
          }
        }
      } catch {}

      // 5. Load pending reports from offline IndexedDB queue
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
            status: (verifiedStatusMap[r.id]?.status || "unverified") as any,
            created_at: r.created_at,
          }));

          const existingIds = new Set(currentReports.map((p) => p.id));
          const fresh = mapped.filter((m) => !existingIds.has(m.id));
          currentReports = [...fresh, ...currentReports];
        }
      } catch (err) {
        console.warn("Could not check offline IndexedDB queue:", err);
      }

      // 6. If not demo, fetch real reports from Supabase
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
              status: (verifiedStatusMap[r.id]?.status || r.status) as any,
              created_at: r.created_at,
            }));
            currentReports = mapped;
          }
        } catch (err) {
          console.warn("Supabase reports query error:", err);
        }
      }

      setReports(currentReports);
    }

    loadReports();

    const handleNewReportEvent = (e: any) => {
      const r = e.detail;
      if (!r) return;
      setReports((prev) => {
        if (prev.some((p) => p.id === r.id)) return prev;
        return [
          {
            id: r.id,
            category: r.category,
            corridor_name: r.corridor_name || r.nearest_landmark || "East Khasi Hills Corridor",
            segment_id: r.segment_id || "seg-002",
            lat: r.lat,
            lng: r.lng,
            severity: r.severity || 3,
            description: r.description || "Field incident reported",
            status: "unverified",
            created_at: r.created_at,
          },
          ...prev,
        ];
      });
    };

    const handleHazardResolvedEvent = (e: any) => {
      const { corridorId, incidentId } = e.detail || {};
      if (corridorId) {
        setClearedCorridorIds((prev) => Array.from(new Set([...prev, corridorId])));
      }
      if (incidentId) {
        setResolvedIncidentIds((prev) => Array.from(new Set([...prev, incidentId])));
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("setu_new_report_submitted", handleNewReportEvent);
      window.addEventListener("setu_hazard_resolved", handleHazardResolvedEvent);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("setu_new_report_submitted", handleNewReportEvent);
        window.removeEventListener("setu_hazard_resolved", handleHazardResolvedEvent);
      }
    };
  }, [isDemo]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function handleVerify(id: string) {
    const targetReport = reports.find((r) => r.id === id);
    if (!targetReport) return;

    // Use unified hazard-sync to mark verified, un-clear corridor, and update all stores
    markReportVerified({
      id: targetReport.id,
      category: targetReport.category,
      corridor_name: targetReport.corridor_name,
      segment_id: targetReport.segment_id,
      lat: targetReport.lat,
      lng: targetReport.lng,
      severity: targetReport.severity,
      description: targetReport.description,
    });

    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "verified" as const } : r))
    );

    // Remove corridor from cleared corridors state
    const segId = targetReport.segment_id || (id === "rep-ekh-002" ? "seg-013" : "seg-010");
    setClearedCorridorIds((prev) => prev.filter((cid) => cid !== segId));
    setResolvedIncidentIds((prev) => prev.filter((rid) => rid !== id && rid !== `inc-${id}`));

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

    showToast(`✅ ${targetReport.corridor_name} VERIFIED! Listed on GIS Risk Map & Avoidance Route Active.`);
  }

  async function handleReject(id: string) {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "rejected" as const } : r))
    );

    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("setu_verified_reports");
        const vMap = raw ? JSON.parse(raw) : {};
        vMap[id] = { id, status: "rejected" };
        localStorage.setItem("setu_verified_reports", JSON.stringify(vMap));
      }
      await fetch("/api/reports/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected" }),
      });
    } catch {}

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
                      background: "rgba(10, 104, 71, 0.1)",
                      border: "1px solid var(--color-primary-light)",
                      color: "var(--color-primary)",
                      padding: "5px 12px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
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
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {report.status === "verified" && (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "4px 8px",
                          borderRadius: "6px",
                          textAlign: "center",
                          background:
                            clearedCorridorIds.includes(report.segment_id || "") ||
                            resolvedIncidentIds.includes(report.id) ||
                            resolvedIncidentIds.includes(`inc-${report.id}`)
                              ? "rgba(34, 197, 94, 0.15)"
                              : "rgba(239, 68, 68, 0.15)",
                          color:
                            clearedCorridorIds.includes(report.segment_id || "") ||
                            resolvedIncidentIds.includes(report.id) ||
                            resolvedIncidentIds.includes(`inc-${report.id}`)
                              ? "#16a34a"
                              : "#dc2626",
                          border:
                            clearedCorridorIds.includes(report.segment_id || "") ||
                            resolvedIncidentIds.includes(report.id) ||
                            resolvedIncidentIds.includes(`inc-${report.id}`)
                              ? "1px solid #86efac"
                              : "1px solid #fca5a5",
                        }}
                      >
                        {clearedCorridorIds.includes(report.segment_id || "") ||
                        resolvedIncidentIds.includes(report.id) ||
                        resolvedIncidentIds.includes(`inc-${report.id}`)
                          ? "🟢 Hazard Fixed & Road Reopened (PWD Cleared)"
                          : "🔴 Active on GIS Risk Map • Auto-Detour Enforced"}
                      </div>
                    )}
                    <button
                      disabled
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "8px",
                        background: "var(--color-bg)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text-muted)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "default",
                      }}
                    >
                      Status Locked: {report.status.toUpperCase()}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
