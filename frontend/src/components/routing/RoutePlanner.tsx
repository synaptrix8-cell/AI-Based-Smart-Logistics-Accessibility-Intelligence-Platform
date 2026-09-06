"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  KEY_HUBS,
  KeyHub,
  computeClientSafeRoute,
} from "@/lib/data/road-segments";
import styles from "./routing.module.css";

interface RouteOverlay {
  coordinates: [number, number][]; // [lat, lng]
  distance_km: number;
  avg_risk: number;
  corridors: string[];
  is_rerouted?: boolean;
  reroute_reason?: string;
}

interface RoutePlannerProps {
  onRouteCalculated: (
    safe: RouteOverlay | null,
    shortest: RouteOverlay | null,
    originCoords: [number, number] | null,
    destCoords: [number, number] | null
  ) => void;
  selectedOriginId?: string | null;
  selectedDestId?: string | null;
  onOriginChange?: (id: string) => void;
  onDestChange?: (id: string) => void;
  blockedSegmentIds?: string[];
}

export default function RoutePlanner({
  onRouteCalculated,
  selectedOriginId,
  selectedDestId,
  onOriginChange,
  onDestChange,
  blockedSegmentIds = [],
}: RoutePlannerProps) {
  const [originId, setOriginId] = useState<string>("nongpoh");
  const [destId, setDestId] = useState<string>("cherrapunji");
  const [avoidRiskThreshold, setAvoidRiskThreshold] = useState<number>(0.7);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{
    safe: RouteOverlay;
    shortest: RouteOverlay;
    riskReductionPct: number;
    vehicleAdvisory?: string;
    steps?: { instruction: string; distance_km: number }[];
  } | null>(null);

  // Sync external selections (e.g. from map town clicks)
  useEffect(() => {
    if (selectedOriginId) setOriginId(selectedOriginId);
  }, [selectedOriginId]);

  useEffect(() => {
    if (selectedDestId) setDestId(selectedDestId);
  }, [selectedDestId]);

  const handleComputeRoute = useCallback(async () => {
    const originHub = KEY_HUBS.find((h) => h.id === originId);
    const destHub = KEY_HUBS.find((h) => h.id === destId);

    if (!originHub || !destHub) return;
    setIsCalculating(true);

    try {
      // 1. Query Next.js real OpenStreetMap routing engine
      let routingSuccess = false;
      try {
        const resp = await fetch("/api/routing/safe-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin_lat: originHub.coords[0],
            origin_lng: originHub.coords[1],
            dest_lat: destHub.coords[0],
            dest_lng: destHub.coords[1],
            avoid_risk_above: avoidRiskThreshold,
            blocked_segment_ids: blockedSegmentIds,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data.safe_route && data.shortest_route) {
            const safe: RouteOverlay = {
              coordinates: data.safe_route.coordinates,
              distance_km: data.safe_route.distance_km,
              avg_risk: data.safe_route.avg_risk,
              corridors: data.safe_route.corridors,
              is_rerouted: data.safe_route.is_rerouted,
              reroute_reason: data.safe_route.reroute_reason,
            };
            const shortest: RouteOverlay = {
              coordinates: data.shortest_route.coordinates,
              distance_km: data.shortest_route.distance_km,
              avg_risk: data.shortest_route.avg_risk,
              corridors: data.shortest_route.corridors,
            };
            setLastResult({
              safe,
              shortest,
              riskReductionPct: data.risk_reduction_pct,
              vehicleAdvisory: data.safe_route.vehicle_advisory,
              steps: data.safe_route.steps,
            });
            onRouteCalculated(safe, shortest, originHub.coords, destHub.coords);
            routingSuccess = true;
          }
        }
      } catch (err) {
        console.warn("OSRM routing API error, using client fallback:", err);
      }

      // 2. Client-side Dijkstra Fallback
      if (!routingSuccess) {
        const clientRes = computeClientSafeRoute(
          originHub.coords,
          destHub.coords,
          avoidRiskThreshold,
          blockedSegmentIds
        );

        const safe: RouteOverlay = {
          coordinates: clientRes.safe_route.coordinates,
          distance_km: clientRes.safe_route.distance_km,
          avg_risk: clientRes.safe_route.avg_risk,
          corridors: clientRes.safe_route.corridors,
          is_rerouted: clientRes.safe_route.is_rerouted,
          reroute_reason: clientRes.safe_route.reroute_reason,
        };
        const shortest: RouteOverlay = {
          coordinates: clientRes.shortest_route.coordinates,
          distance_km: clientRes.shortest_route.distance_km,
          avg_risk: clientRes.shortest_route.avg_risk,
          corridors: clientRes.shortest_route.corridors,
          is_rerouted: false,
        };

        setLastResult({
          safe,
          shortest,
          riskReductionPct: clientRes.risk_reduction_pct,
          vehicleAdvisory: clientRes.safe_route.is_rerouted
            ? "🛡️ Autonomous Reroute Active: Detoured around active hazard via alternate corridor."
            : "Direct highway transit permitted. Road is clear and safe for all transport.",
        });
        onRouteCalculated(safe, shortest, originHub.coords, destHub.coords);
      }
    } finally {
      setIsCalculating(false);
    }
  }, [originId, destId, avoidRiskThreshold, blockedSegmentIds, onRouteCalculated]);

  // Keep a ref to handleComputeRoute so the blocked-change effect can call it safely
  const computeRef = useRef(handleComputeRoute);
  useEffect(() => {
    computeRef.current = handleComputeRoute;
  }, [handleComputeRoute]);

  // Auto re-compute whenever blockedSegmentIds changes and a route was already calculated
  const prevBlockedRef = useRef<string>(JSON.stringify(blockedSegmentIds));
  useEffect(() => {
    const currentStr = JSON.stringify(blockedSegmentIds);
    if (prevBlockedRef.current !== currentStr) {
      prevBlockedRef.current = currentStr;
      if (lastResult) {
        computeRef.current();
      }
    }
  }, [blockedSegmentIds, lastResult]);

  // Immediately recompute route when a hazard is officially verified or fixed
  useEffect(() => {
    const handleRecomputeOnEvent = () => {
      computeRef.current();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("setu_hazard_resolved", handleRecomputeOnEvent);
      window.addEventListener("setu_hazard_verified", handleRecomputeOnEvent);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("setu_hazard_resolved", handleRecomputeOnEvent);
        window.removeEventListener("setu_hazard_verified", handleRecomputeOnEvent);
      }
    };
  }, []);

  const handleClear = () => {
    setLastResult(null);
    onRouteCalculated(null, null, null, null);
  };

  return (
    <div className={styles.plannerCard}>
      <div className={styles.plannerHeader}>
        <div className={styles.plannerTitleRow}>
          <span className={styles.plannerIcon}>🛣️</span>
          <div>
            <h3>AI Safe-Route Finder</h3>
            <p>Dijkstra pathfinding avoiding landslide & flood-prone corridors</p>
          </div>
        </div>
      </div>

      <div className={styles.plannerForm}>
        {/* Origin Hub */}
        <div className={styles.formGroup}>
          <label className={styles.inputLabel}>Origin Logistics Hub</label>
          <select
            className={styles.selectInput}
            value={originId}
            onChange={(e) => {
              const val = e.target.value;
              setOriginId(val);
              onOriginChange?.(val);
            }}
          >
            {KEY_HUBS.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.name} ({hub.elevation_m}m)
              </option>
            ))}
          </select>
        </div>

        {/* Destination Hub */}
        <div className={styles.formGroup}>
          <label className={styles.inputLabel}>Destination Hub</label>
          <select
            className={styles.selectInput}
            value={destId}
            onChange={(e) => {
              const val = e.target.value;
              setDestId(val);
              onDestChange?.(val);
            }}
          >
            {KEY_HUBS.map((hub) => (
              <option key={hub.id} value={hub.id} disabled={hub.id === originId}>
                {hub.name} ({hub.elevation_m}m)
              </option>
            ))}
          </select>
        </div>

        {/* Risk Threshold Slider */}
        <div className={styles.formGroup}>
          <div className={styles.sliderHeader}>
            <label className={styles.inputLabel}>Avoid Segments Above Risk:</label>
            <span className={styles.sliderValue}>{(avoidRiskThreshold * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.4"
            max="0.9"
            step="0.05"
            value={avoidRiskThreshold}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setAvoidRiskThreshold(val);
            }}
            className={styles.rangeSlider}
          />
          <div className={styles.sliderLabels}>
            <span>Strict (40%)</span>
            <span>Balanced (70%)</span>
            <span>Permissive (90%)</span>
          </div>

          {/* Dynamic mode explanation */}
          <div
            style={{
              marginTop: "6px",
              padding: "5px 10px",
              borderRadius: "6px",
              fontSize: "0.72rem",
              fontWeight: 600,
              background:
                avoidRiskThreshold <= 0.5
                  ? "#FEF2F2"
                  : avoidRiskThreshold <= 0.75
                  ? "#EFF6FF"
                  : "#FFFBEB",
              color:
                avoidRiskThreshold <= 0.5
                  ? "#991B1B"
                  : avoidRiskThreshold <= 0.75
                  ? "#1D4ED8"
                  : "#92400E",
              border:
                avoidRiskThreshold <= 0.5
                  ? "1px solid #FECACA"
                  : avoidRiskThreshold <= 0.75
                  ? "1px solid #BFDBFE"
                  : "1px solid #FDE68A",
            }}
          >
            {avoidRiskThreshold <= 0.5
              ? `🛡️ Strict Mode (${(avoidRiskThreshold * 100).toFixed(0)}%): Avoiding all roads > ${(avoidRiskThreshold * 100).toFixed(0)}% risk (Reroutes around wet & slippery grades)`
              : avoidRiskThreshold <= 0.75
              ? `⚖️ Balanced Mode (${(avoidRiskThreshold * 100).toFixed(0)}%): Avoiding verified landslide & severe hazard zones (> 70% risk)`
              : `⚡ Permissive Mode (${(avoidRiskThreshold * 100).toFixed(0)}%): Direct express transit (Permitting travel through sectors up to ${(avoidRiskThreshold * 100).toFixed(0)}% risk)`}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={`btn btn-primary ${styles.computeBtn}`}
            onClick={handleComputeRoute}
            disabled={isCalculating || originId === destId}
          >
            {isCalculating ? "Calculating Dijkstra Path..." : "Find Alternate Safe Route →"}
          </button>
          {lastResult && (
            <button
              type="button"
              className={`btn btn-secondary ${styles.clearBtn}`}
              onClick={handleClear}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Results Comparison Card */}
      {lastResult && (
        <div className={styles.resultsCard}>
          <div className={styles.recommendationBanner}>
            <span className={styles.checkIcon}>✅</span>
            <div>
              <strong>Safe Route Calculated</strong>
              <p>
                {lastResult.riskReductionPct > 0
                  ? `Achieves a ${lastResult.riskReductionPct}% reduction in hazard exposure vs shortest path.`
                  : `Direct path is currently safe with minimal risk exposure.`}
              </p>
            </div>
          </div>

          <div className={styles.comparisonGrid}>
            {/* Safe Route Result */}
            <div className={`${styles.resultBox} ${styles.safeResultBox}`}>
              <div className={styles.resultBoxHeader}>
                <span className={styles.dotCyan} />
                <span>Setu Safe Route (Active)</span>
              </div>
              <div className={styles.metricVal}>{lastResult.safe.distance_km} km</div>
              <div className={styles.metricSub}>
                Avg Risk:{" "}
                <strong style={{ color: lastResult.safe.avg_risk < 0.4 ? "#22C55E" : "#F59E0B" }}>
                  {lastResult.safe.avg_risk.toFixed(2)}
                </strong>
              </div>
            </div>

            {/* Direct Shortest Route Result */}
            <div className={`${styles.resultBox} ${styles.shortestResultBox}`}>
              <div className={styles.resultBoxHeader}>
                <span className={styles.dotOrange} />
                <span>Direct Shortest Route</span>
              </div>
              <div className={styles.metricVal}>{lastResult.shortest.distance_km} km</div>
              <div className={styles.metricSub}>
                Avg Risk:{" "}
                <strong style={{ color: lastResult.shortest.avg_risk >= 0.7 ? "#EF4444" : "#F59E0B" }}>
                  {lastResult.shortest.avg_risk.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>

          {lastResult.safe.corridors.length > 0 && (
            <div className={styles.corridorList}>
              <span className={styles.corridorTitle}>Corridors Traversed:</span>
              <div className={styles.tags}>
                {lastResult.safe.corridors.map((c, i) => (
                  <span key={i} className={styles.corridorTag}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Freight Vehicle Passability Advisory */}
          <div
            style={{
              marginTop: "12px",
              padding: "8px 12px",
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "8px",
              fontSize: "0.75rem",
              color: "#166534",
            }}
          >
            <strong>🚚 Vehicle Passability:</strong>{" "}
            {lastResult.vehicleAdvisory ||
              "All-weather paved highway network. Passable for heavy logistics freight & relief trucks."}
          </div>

          {/* Turn-by-turn road steps */}
          {lastResult.steps && lastResult.steps.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <span className={styles.corridorTitle}>Navigation Waypoints:</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                {lastResult.steps.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-secondary, #475569)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{i + 1}. {s.instruction}</span>
                    <strong style={{ color: "#0A6847" }}>{s.distance_km} km</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
