"use client";

import { useState, useEffect, useCallback } from "react";
import DynamicRiskMap from "@/components/map/DynamicRiskMap";
import type { MapRiskStats } from "@/components/map/RiskMap";
import RoutePlanner from "@/components/routing/RoutePlanner";
import ReportModal from "@/components/reporting/ReportModal";
import { RoadSegmentData, EAST_KHASI_HILLS_SEGMENTS, KEY_HUBS } from "@/lib/data/road-segments";
import styles from "./dashboard-view.module.css";
import pageStyles from "../../app/dashboard/dashboard.module.css";

interface RouteOverlay {
  coordinates: [number, number][];
  distance_km: number;
  avg_risk: number;
  corridors: string[];
  is_rerouted?: boolean;
  reroute_reason?: string;
}

export default function LiveDashboardView() {
  const [selectedSegment, setSelectedSegment] = useState<RoadSegmentData | null>(null);
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [safeRoute, setSafeRoute] = useState<RouteOverlay | null>(null);
  const [shortestRoute, setShortestRoute] = useState<RouteOverlay | null>(null);
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [originHubId, setOriginHubId] = useState<string>("nongpoh");
  const [destHubId, setDestHubId] = useState<string>("cherrapunji");
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportMode, setReportMode] = useState<"driver" | "officer">("driver");
  const [dismissAdvisory, setDismissAdvisory] = useState<boolean>(false);
  const [blockedSegmentIds, setBlockedSegmentIds] = useState<string[]>([]);
  const [clearedCorridors, setClearedCorridors] = useState<string[]>([]);
  const [resolvedNotice, setResolvedNotice] = useState<string | null>(null);
  const [mapStats, setMapStats] = useState<MapRiskStats>(() => {
    const high = EAST_KHASI_HILLS_SEGMENTS.filter((s) => s.risk_score >= 0.7).length;
    const medium = EAST_KHASI_HILLS_SEGMENTS.filter((s) => s.risk_score >= 0.4 && s.risk_score < 0.7).length;
    return {
      total: EAST_KHASI_HILLS_SEGMENTS.length,
      high,
      medium,
      low: EAST_KHASI_HILLS_SEGMENTS.length - high - medium,
      activeHazards: 0,
      resolvedHazards: 0,
    };
  });

  // Sync persisted cleared corridors and verified reports on mount across hard refreshes
  useEffect(() => {
    let currentCleared: string[] = [];
    try {
      if (typeof window !== "undefined") {
        const clearedRaw = localStorage.getItem("setu_cleared_corridors");
        if (clearedRaw) {
          currentCleared = JSON.parse(clearedRaw);
          setClearedCorridors(currentCleared);
          setBlockedSegmentIds((prev) => prev.filter((id) => !currentCleared.includes(id)));
        }

        // Hydrate verified reports into blocked corridors if not cleared
        const rawVR = localStorage.getItem("setu_verified_reports");
        if (rawVR) {
          const vMap = JSON.parse(rawVR);
          const activeVerifiedCorridors: string[] = [];
          Object.values(vMap).forEach((vr: any) => {
            if (vr.status === "verified") {
              const corrId = vr.segment_id || (vr.id === "rep-ekh-002" ? "seg-013" : "seg-010");
              if (!currentCleared.includes(corrId)) {
                activeVerifiedCorridors.push(corrId);
              }
            }
          });
          if (activeVerifiedCorridors.length > 0) {
            setBlockedSegmentIds((prev) => Array.from(new Set([...prev, ...activeVerifiedCorridors])));
          }
        }
      }
    } catch {}

    // Also fetch server-side verified reports
    fetch("/api/reports/verify")
      .then((r) => r.json())
      .then((vData) => {
        if (vData?.verified_reports && Array.isArray(vData.verified_reports)) {
          const apiCorridors: string[] = [];
          vData.verified_reports.forEach((vr: any) => {
            if (vr.status === "verified") {
              const corrId = vr.segment_id || (vr.id === "rep-ekh-002" ? "seg-013" : "seg-010");
              if (!currentCleared.includes(corrId)) {
                apiCorridors.push(corrId);
              }
            }
          });
          if (apiCorridors.length > 0) {
            setBlockedSegmentIds((prev) => Array.from(new Set([...prev, ...apiCorridors])));
          }
        }
      })
      .catch(() => {});

    fetch("/api/alerts/resolve")
      .then((r) => r.json())
      .then((data) => {
        if (data?.cleared_corridors && Array.isArray(data.cleared_corridors)) {
          setClearedCorridors((prev) => Array.from(new Set([...prev, ...data.cleared_corridors])));
          setBlockedSegmentIds((prev) =>
            prev.filter((id) => !data.cleared_corridors.includes(id))
          );
        }
      })
      .catch(() => {});

    // Listen to real-time verification event from reports queue
    const handleHazardVerified = (e: any) => {
      const vr = e.detail;
      if (!vr) return;
      const corrId = vr.segment_id || (vr.id === "rep-ekh-002" ? "seg-013" : "seg-010");
      setBlockedSegmentIds((prev) => Array.from(new Set([...prev, corrId])));
      setClearedCorridors((prev) => prev.filter((id) => id !== corrId));
      setResolvedNotice(null);
    };

    // Listen to real-time hazard resolution event (e.g. from bottom feed official button)
    const handleHazardResolved = (e: any) => {
      const { corridorId } = e.detail || {};
      if (corridorId) {
        setClearedCorridors((prev) => Array.from(new Set([...prev, corridorId])));
        setBlockedSegmentIds((prev) => prev.filter((id) => id !== corridorId));
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("setu_hazard_verified", handleHazardVerified);
      window.addEventListener("setu_hazard_resolved", handleHazardResolved);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("setu_hazard_verified", handleHazardVerified);
        window.removeEventListener("setu_hazard_resolved", handleHazardResolved);
      }
    };
  }, []);

  const handleSimulateWhatsAppReport = async () => {
    try {
      // Clear previous resolved status for fresh demonstration
      try {
        if (typeof window !== "undefined") {
          const clearedRaw = localStorage.getItem("setu_cleared_corridors");
          if (clearedRaw) {
            const list = JSON.parse(clearedRaw).filter((id: string) => id !== "seg-002");
            localStorage.setItem("setu_cleared_corridors", JSON.stringify(list));
            setClearedCorridors(list);
          }
          const resolvedRaw = localStorage.getItem("setu_resolved_incidents");
          if (resolvedRaw) {
            const obj = JSON.parse(resolvedRaw);
            delete obj["live-001"];
            localStorage.setItem("setu_resolved_incidents", JSON.stringify(obj));
          }
        }
      } catch {}

      const resp = await fetch("/api/alerts/inbound-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "whatsapp:+919436188210",
          body: "Flash flood overflowing over NH-6 culvert near Umsning! Road completely blocked for trucks.",
          location: "Umsning",
          hazard_type: "flood",
          photo_url: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=600&auto=format&fit=crop&q=80",
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const blockedId = data.affected_corridor?.id || "seg-002";
        setBlockedSegmentIds((prev) => Array.from(new Set([...prev, blockedId])));
        setResolvedNotice(null);

        // If a route is active from Nongpoh to Cherrapunji, trigger real-time dynamic reroute!
        if (originHubId && destHubId) {
          const orig = KEY_HUBS.find((h) => h.id === originHubId);
          const dest = KEY_HUBS.find((h) => h.id === destHubId);
          if (orig && dest) {
            const routeResp = await fetch("/api/routing/safe-route", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                origin_lat: orig.coords[0],
                origin_lng: orig.coords[1],
                dest_lat: dest.coords[0],
                dest_lng: dest.coords[1],
                blocked_segment_ids: [blockedId],
                live_hazard_location: data.affected_corridor?.name,
              }),
            });
            if (routeResp.ok) {
              const rData = await routeResp.json();
              if (rData.safe_route) {
                setSafeRoute(rData.safe_route);
              }
              if (rData.shortest_route) {
                setShortestRoute(rData.shortest_route);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("WhatsApp test error:", err);
    }
  };

  const handleSimulateDawkiReport = async () => {
    try {
      const blockedId = "seg-013";
      // Clear previous resolved status for fresh demonstration of Dawki
      try {
        if (typeof window !== "undefined") {
          const clearedRaw = localStorage.getItem("setu_cleared_corridors");
          if (clearedRaw) {
            const list = JSON.parse(clearedRaw).filter((id: string) => id !== blockedId);
            localStorage.setItem("setu_cleared_corridors", JSON.stringify(list));
            setClearedCorridors(list);
          }
          const resolvedRaw = localStorage.getItem("setu_resolved_incidents");
          if (resolvedRaw) {
            const obj = JSON.parse(resolvedRaw);
            delete obj["inc-rep-ekh-002"];
            delete obj["rep-ekh-002"];
            delete obj["live-005"];
            localStorage.setItem("setu_resolved_incidents", JSON.stringify(obj));
          }

          // Persist Dawki report as verified
          const rawVR = localStorage.getItem("setu_verified_reports");
          const vMap = rawVR ? JSON.parse(rawVR) : {};
          vMap["rep-ekh-002"] = {
            id: "rep-ekh-002",
            status: "verified",
            corridor_name: "Pynursla-Dawki Border Highway (NH-40)",
            segment_id: "seg-013",
            lat: 25.2104,
            lng: 91.9541,
            severity: 4,
            description: "Active rockfall chute blocking northbound freight traffic. Multi-axle trucks impassable.",
            verified_at: new Date().toISOString(),
          };
          localStorage.setItem("setu_verified_reports", JSON.stringify(vMap));

          window.dispatchEvent(
            new CustomEvent("setu_hazard_verified", { detail: vMap["rep-ekh-002"] })
          );
        }
      } catch {}

      setBlockedSegmentIds((prev) => Array.from(new Set([...prev, blockedId])));
      setClearedCorridors((prev) => prev.filter((id) => id !== blockedId));
      setResolvedNotice(null);

      // Select route to Dawki
      setOriginHubId("shillong_center");
      setDestHubId("dawki");

      const orig = KEY_HUBS.find((h) => h.id === "shillong_center");
      const dest = KEY_HUBS.find((h) => h.id === "dawki");
      if (orig && dest) {
        const routeResp = await fetch("/api/routing/safe-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin_lat: orig.coords[0],
            origin_lng: orig.coords[1],
            dest_lat: dest.coords[0],
            dest_lng: dest.coords[1],
            blocked_segment_ids: [blockedId],
            live_hazard_location: "Pynursla-Dawki Border Highway (NH-40)",
          }),
        });
        if (routeResp.ok) {
          const rData = await routeResp.json();
          if (rData.safe_route) {
            setSafeRoute(rData.safe_route);
          }
          if (rData.shortest_route) {
            setShortestRoute(rData.shortest_route);
          }
        }
      }
    } catch (err) {
      console.warn("Dawki test error:", err);
    }
  };

  const handleResolveHazard = async (corridorId: string = "seg-002", incidentId?: string) => {
    try {
      // Persist cleared corridor to localStorage immediately so it survives hard-refresh
      try {
        if (typeof window !== "undefined") {
          const clearedRaw = localStorage.getItem("setu_cleared_corridors");
          const clearedList: string[] = clearedRaw ? JSON.parse(clearedRaw) : [];
          if (!clearedList.includes(corridorId)) {
            clearedList.push(corridorId);
            localStorage.setItem("setu_cleared_corridors", JSON.stringify(clearedList));
          }
        }
      } catch {}

      await fetch("/api/alerts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corridor_id: corridorId,
          incident_id: incidentId,
          resolved_by: "Meghalaya PWD (NH Division) & SDRF Rapid Clearing Unit",
          notes: "Obstruction cleared with earthmover. Pavement inspected and declared 100% safe for transit.",
        }),
      });

      // Unblock corridor on map (turns back to green!)
      setClearedCorridors((prev) => Array.from(new Set([...prev, corridorId])));
      setBlockedSegmentIds((prev) => prev.filter((id) => id !== corridorId));

      const corr = EAST_KHASI_HILLS_SEGMENTS.find((s) => s.id === corridorId);
      const corrName = corr?.name || "Corridor";
      const nowStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      setResolvedNotice(`${corrName} verified 100% CLEARED by District PWD at ${nowStr}. Road reopened for all transit.`);

      // Recalculate route back to direct highway!
      if (originHubId && destHubId) {
        const orig = KEY_HUBS.find((h) => h.id === originHubId);
        const dest = KEY_HUBS.find((h) => h.id === destHubId);
        if (orig && dest) {
          const remainingBlocks = blockedSegmentIds.filter((id) => id !== corridorId);
          const routeResp = await fetch("/api/routing/safe-route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin_lat: orig.coords[0],
              origin_lng: orig.coords[1],
              dest_lat: dest.coords[0],
              dest_lng: dest.coords[1],
              blocked_segment_ids: remainingBlocks,
            }),
          });
          if (routeResp.ok) {
            const rData = await routeResp.json();
            if (rData.safe_route) {
              setSafeRoute(rData.safe_route);
            }
            if (rData.shortest_route) {
              setShortestRoute(rData.shortest_route);
            }
          }
        }
      }
    } catch (err) {
      console.warn("Resolve hazard error:", err);
    }
  };

  const handleRouteCalculated = (
    safe: RouteOverlay | null,
    shortest: RouteOverlay | null,
    orig: [number, number] | null,
    dest: [number, number] | null
  ) => {
    setSafeRoute(safe);
    setShortestRoute(shortest);
    setOriginCoords(orig);
    setDestCoords(dest);
  };

  const handleMapStatsChange = useCallback((stats: MapRiskStats) => {
    setMapStats(stats);
    if (stats.activeHazards === 0) {
      setBlockedSegmentIds((prev) => (prev.length > 0 ? [] : prev));
    }
  }, []);

  const highRiskCount = mapStats.high;
  const mediumRiskCount = mapStats.medium;
  const lowRiskCount = mapStats.low;

  const isSelectedBlocked = selectedSegment ? blockedSegmentIds.includes(selectedSegment.id) : false;
  const selectedEffectiveRisk = isSelectedBlocked ? 0.98 : (selectedSegment?.risk_score ?? 0);
  const selectedRiskLevel = isSelectedBlocked
    ? "CRITICAL (LANDSLIDE BLOCKED)"
    : selectedEffectiveRisk >= 0.7
    ? "HIGH / CRITICAL"
    : selectedEffectiveRisk >= 0.4
    ? "MEDIUM (CAUTION)"
    : "LOW (PASSABLE)";

  return (
    <div className={styles.container}>
      {/* Dynamic KPI Stats overview */}
      <div className={pageStyles.statsGrid} style={{ marginBottom: "20px" }}>
        <div className={`card ${pageStyles.statCard}`}>
          <div className={pageStyles.statIcon}>🗺️</div>
          <div className={pageStyles.statContent}>
            <span className={pageStyles.statValue}>{EAST_KHASI_HILLS_SEGMENTS.length}</span>
            <span className={pageStyles.statLabel}>Monitored Corridors</span>
          </div>
        </div>
        <div className={`card ${pageStyles.statCard}`}>
          <div className={pageStyles.statIcon}>⚠️</div>
          <div className={pageStyles.statContent}>
            <span className={pageStyles.statValue} style={{ color: highRiskCount > 0 ? "var(--risk-high)" : "var(--color-text)" }}>
              {highRiskCount}
            </span>
            <span className={pageStyles.statLabel}>High Hazard Zones</span>
          </div>
        </div>
        <div className={`card ${pageStyles.statCard}`}>
          <div className={pageStyles.statIcon}>🌦️</div>
          <div className={pageStyles.statContent}>
            <span className={pageStyles.statValue}>4</span>
            <span className={pageStyles.statLabel}>Active Weather Feeds</span>
          </div>
        </div>
        <div className={`card ${pageStyles.statCard}`}>
          <div className={pageStyles.statIcon}>🛡️</div>
          <div className={pageStyles.statContent}>
            <span className={pageStyles.statValue} style={{ color: "var(--color-primary-light)" }}>
              Online
            </span>
            <span className={pageStyles.statLabel}>Dijkstra Safe Routing</span>
          </div>
        </div>
      </div>

      {/* Active Regional Hazard Advisory Banner (Phase 4 integration) */}
      {!dismissAdvisory && (
        <div
          style={{
            background: "linear-gradient(90deg, #FEF2F2 0%, #FFFBEB 100%)",
            border: "1px solid #FCA5A5",
            borderRadius: "12px",
            padding: "10px 16px",
            marginBottom: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 6px rgba(239, 68, 68, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.2rem" }}>🚨</span>
            <div>
              <strong style={{ color: "#991B1B", fontSize: "0.85rem" }}>
                Active Regional Hazard Advisory: East Khasi Hills (Cherrapunji & NH-6 Sectors)
              </strong>
              <div style={{ color: "#78350F", fontSize: "0.75rem" }}>
                {highRiskCount} corridors flagged with heavy precipitation (&gt;35mm/h) or geotechnical hazard. Click any town on the map to calculate a hazard-free safe detour.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              style={{
                background: "#DC2626",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "6px",
                padding: "5px 12px",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => setRiskFilter("HIGH")}
            >
              Filter Hazards ({highRiskCount})
            </button>
            <button
              type="button"
              style={{
                background: "transparent",
                border: "none",
                color: "#9CA3AF",
                fontSize: "1.1rem",
                cursor: "pointer",
                padding: "2px 6px",
              }}
              onClick={() => setDismissAdvisory(true)}
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Risk Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Corridor Filter:</span>
          <button
            type="button"
            className={`${styles.filterBtn} ${riskFilter === "ALL" ? styles.activeFilter : ""}`}
            onClick={() => setRiskFilter("ALL")}
          >
            All Corridors ({EAST_KHASI_HILLS_SEGMENTS.length})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${riskFilter === "HIGH" ? styles.activeHigh : ""}`}
            onClick={() => setRiskFilter("HIGH")}
          >
            🔴 High / Critical ({highRiskCount})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${riskFilter === "MEDIUM" ? styles.activeMedium : ""}`}
            onClick={() => setRiskFilter("MEDIUM")}
          >
            🟡 Moderate ({mediumRiskCount})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${riskFilter === "LOW" ? styles.activeLow : ""}`}
            onClick={() => setRiskFilter("LOW")}
          >
            🟢 Clear / Safe ({lowRiskCount})
          </button>
        </div>

        <div className={styles.statusIndicator}>
          <span className={styles.pulseDot} />
          <span>
            Real-time Risk Stream Active • {mapStats.activeHazards} Active Hazards
          </span>
        </div>
      </div>

      {/* Main Grid: Interactive Map + Route Planner */}
      <div className={styles.mainGrid}>
        <div className={styles.mapColumn}>
          <DynamicRiskMap
            selectedSegmentId={selectedSegment?.id}
            onSelectSegment={(seg) => setSelectedSegment(seg)}
            safeRoute={safeRoute}
            shortestRoute={shortestRoute}
            originHubCoords={originCoords}
            destHubCoords={destCoords}
            filterRiskLevel={riskFilter}
            blockedSegmentIds={blockedSegmentIds}
            clearedCorridorIds={clearedCorridors}
            onMapStatsChange={handleMapStatsChange}
            resolvedNotice={resolvedNotice}
            onTriggerWhatsAppDemo={handleSimulateWhatsAppReport}
            onTriggerDawkiDemo={handleSimulateDawkiReport}
            onResolveHazard={handleResolveHazard}
            onSelectHubAsOrigin={(hub) => setOriginHubId(hub.id)}
            onSelectHubAsDest={(hub) => setDestHubId(hub.id)}
          />

          {/* Selected Segment Inspection Drawer */}
          {selectedSegment && (
            <div className={styles.segmentDrawer}>
              <div className={styles.drawerHeader}>
                <div>
                  <div className={styles.drawerBadgeRow}>
                    <span className={styles.highwayBadge}>{selectedSegment.highway_ref}</span>
                    <span
                      className={styles.riskBadge}
                      style={{
                        background:
                          selectedEffectiveRisk >= 0.7
                            ? "rgba(239, 68, 68, 0.15)"
                            : selectedEffectiveRisk >= 0.4
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(34, 197, 94, 0.15)",
                        color:
                          selectedEffectiveRisk >= 0.7
                            ? "#EF4444"
                            : selectedEffectiveRisk >= 0.4
                            ? "#F59E0B"
                            : "#22C55E",
                      }}
                    >
                      Risk Index: {selectedEffectiveRisk.toFixed(2)} ({selectedRiskLevel})
                    </span>
                  </div>
                  <h3 className={styles.drawerTitle}>{selectedSegment.name}</h3>
                </div>
                <button
                  type="button"
                  className={styles.closeDrawerBtn}
                  onClick={() => setSelectedSegment(null)}
                >
                  ✕
                </button>
              </div>

              <div className={styles.factorsRow}>
                <div className={styles.factorCard}>
                  <span className={styles.factorLabel}>Precipitation</span>
                  <strong className={styles.factorValue}>{selectedSegment.factors.rainfall_mm} mm/h</strong>
                  <span className={styles.factorStatus}>
                    {selectedSegment.factors.rainfall_mm > 30 ? "Heavy Downpour" : "Moderate"}
                  </span>
                </div>
                <div className={styles.factorCard}>
                  <span className={styles.factorLabel}>Terrain Gradient</span>
                  <strong className={styles.factorValue}>{selectedSegment.factors.slope_deg}°</strong>
                  <span className={styles.factorStatus}>
                    {selectedSegment.factors.slope_deg > 25 ? "Steep Escarpment" : "Gentle Gradient"}
                  </span>
                </div>
                <div className={styles.factorCard}>
                  <span className={styles.factorLabel}>Verified Hazards</span>
                  <strong className={styles.factorValue}>{selectedSegment.factors.active_reports}</strong>
                  <span className={styles.factorStatus}>
                    {selectedSegment.factors.active_reports > 0 ? "Hazards Active" : "No Blockages"}
                  </span>
                </div>
                <div className={styles.factorCard}>
                  <span className={styles.factorLabel}>Corridor Length</span>
                  <strong className={styles.factorValue}>{selectedSegment.length_km} km</strong>
                  <span className={styles.factorStatus}>Primary Transport Link</span>
                </div>
              </div>

              <button
                type="button"
                className={styles.reportCorridorBtn}
                onClick={() => {
                  setReportMode("driver");
                  setIsReportModalOpen(true);
                }}
              >
                <span>⚠️</span> Flag Incident on this Corridor
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar: AI Safe Route Planner */}
        <div className={styles.sidebarColumn}>
          <RoutePlanner
            onRouteCalculated={handleRouteCalculated}
            selectedOriginId={originHubId}
            selectedDestId={destHubId}
            onOriginChange={(id) => setOriginHubId(id)}
            onDestChange={(id) => setDestHubId(id)}
            blockedSegmentIds={blockedSegmentIds}
          />
        </div>
      </div>

      {/* Floating Action Button for Quick Field Hazard Reporting */}
      <button
        type="button"
        className={styles.reportFloatingBtn}
        onClick={() => {
          setReportMode("driver");
          setIsReportModalOpen(true);
        }}
        title="1-Tap Driver Hazard Report (Photo Snap, Voice, Auto-GPS & WhatsApp)"
        style={{
          background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
          border: "2px solid #34d399",
          boxShadow: "0 8px 24px rgba(5, 150, 105, 0.4)",
          padding: "12px 20px",
          borderRadius: "50px",
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.9rem",
          color: "#ffffff",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "1.3rem" }}>📸</span>
        <span>Driver Quick Report</span>
        <span
          style={{
            background: "#f59e0b",
            color: "#000",
            fontSize: "0.65rem",
            padding: "2px 6px",
            borderRadius: "10px",
            fontWeight: 900,
          }}
        >
          PHOTO
        </span>
      </button>

      {/* Field Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        defaultSegmentId={selectedSegment?.id}
        initialMode={reportMode}
      />
    </div>
  );
}
