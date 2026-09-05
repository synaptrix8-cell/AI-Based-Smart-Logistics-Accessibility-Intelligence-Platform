"use client";

import { useState } from "react";
import DynamicRiskMap from "@/components/map/DynamicRiskMap";
import RoutePlanner from "@/components/routing/RoutePlanner";
import ReportModal from "@/components/reporting/ReportModal";
import { RoadSegmentData, EAST_KHASI_HILLS_SEGMENTS } from "@/lib/data/road-segments";
import styles from "./dashboard-view.module.css";

interface RouteOverlay {
  coordinates: [number, number][];
  distance_km: number;
  avg_risk: number;
  corridors: string[];
}

export default function LiveDashboardView() {
  const [selectedSegment, setSelectedSegment] = useState<RoadSegmentData | null>(null);
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [safeRoute, setSafeRoute] = useState<RouteOverlay | null>(null);
  const [shortestRoute, setShortestRoute] = useState<RouteOverlay | null>(null);
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

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

  const highRiskCount = EAST_KHASI_HILLS_SEGMENTS.filter((s) => s.risk_score >= 0.7).length;
  const mediumRiskCount = EAST_KHASI_HILLS_SEGMENTS.filter((s) => s.risk_score >= 0.4 && s.risk_score < 0.7).length;
  const lowRiskCount = EAST_KHASI_HILLS_SEGMENTS.filter((s) => s.risk_score < 0.4).length;

  return (
    <div className={styles.container}>
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
          <span>Real-time Risk Stream Active</span>
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
                          selectedSegment.risk_score >= 0.7
                            ? "rgba(239, 68, 68, 0.15)"
                            : selectedSegment.risk_score >= 0.4
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(34, 197, 94, 0.15)",
                        color:
                          selectedSegment.risk_score >= 0.7
                            ? "#EF4444"
                            : selectedSegment.risk_score >= 0.4
                            ? "#F59E0B"
                            : "#22C55E",
                      }}
                    >
                      Risk Index: {selectedSegment.risk_score.toFixed(2)} ({selectedSegment.risk_level})
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
                onClick={() => setIsReportModalOpen(true)}
              >
                <span>⚠️</span> Flag Incident on this Corridor
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar: AI Safe Route Planner */}
        <div className={styles.sidebarColumn}>
          <RoutePlanner onRouteCalculated={handleRouteCalculated} />
        </div>
      </div>

      {/* Floating Action Button for Quick Field Hazard Reporting */}
      <button
        type="button"
        className={styles.reportFloatingBtn}
        onClick={() => setIsReportModalOpen(true)}
        title="Report Landslide or Hazard (GPS & Offline Enabled)"
      >
        <span style={{ fontSize: "1.1rem" }}>🚨</span> Report Hazard
      </button>

      {/* Field Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        defaultSegmentId={selectedSegment?.id}
      />
    </div>
  );
}
