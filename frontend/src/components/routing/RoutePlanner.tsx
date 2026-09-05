"use client";

import { useState, useEffect } from "react";
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
}

export default function RoutePlanner({
  onRouteCalculated,
  selectedOriginId,
  selectedDestId,
  onOriginChange,
  onDestChange,
}: RoutePlannerProps) {
  const [originId, setOriginId] = useState<string>("nongpoh");
  const [destId, setDestId] = useState<string>("cherrapunji");
  const [avoidRiskThreshold, setAvoidRiskThreshold] = useState<number>(0.7);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{
    safe: RouteOverlay;
    shortest: RouteOverlay;
    riskReductionPct: number;
  } | null>(null);

  // Sync external selections (e.g. from map town clicks)
  useEffect(() => {
    if (selectedOriginId) setOriginId(selectedOriginId);
  }, [selectedOriginId]);

  useEffect(() => {
    if (selectedDestId) setDestId(selectedDestId);
  }, [selectedDestId]);

  const handleComputeRoute = async () => {
    const originHub = KEY_HUBS.find((h) => h.id === originId);
    const destHub = KEY_HUBS.find((h) => h.id === destId);

    if (!originHub || !destHub) return;
    setIsCalculating(true);

    try {
      // 1. Attempt backend FastAPI routing endpoint if NEXT_PUBLIC_API_URL is available
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      let backendSuccess = false;

      if (apiUrl && !apiUrl.includes("your-risk-engine")) {
        try {
          const resp = await fetch(`${apiUrl}/api/v1/routing/safe-route`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin_lat: originHub.coords[0],
              origin_lng: originHub.coords[1],
              dest_lat: destHub.coords[0],
              dest_lng: destHub.coords[1],
              avoid_risk_above: avoidRiskThreshold,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const safe: RouteOverlay = {
              coordinates: data.safe_route.coordinates.map(
                (c: [number, number]) => [c[1], c[0]]
              ),
              distance_km: data.safe_route.distance_km,
              avg_risk: data.safe_route.avg_risk,
              corridors: data.safe_route.corridors,
            };
            const shortest: RouteOverlay = {
              coordinates: data.shortest_route.coordinates.map(
                (c: [number, number]) => [c[1], c[0]]
              ),
              distance_km: data.shortest_route.distance_km,
              avg_risk: data.shortest_route.avg_risk,
              corridors: data.shortest_route.corridors,
            };
            setLastResult({
              safe,
              shortest,
              riskReductionPct: data.risk_reduction_pct,
            });
            onRouteCalculated(safe, shortest, originHub.coords, destHub.coords);
            backendSuccess = true;
          }
        } catch {
          // Fallback to client-side Dijkstra
        }
      }

      // 2. Client-side Dijkstra Fallback
      if (!backendSuccess) {
        const clientRes = computeClientSafeRoute(
          originHub.coords,
          destHub.coords,
          avoidRiskThreshold
        );

        const safe: RouteOverlay = {
          coordinates: clientRes.safe_route.coordinates,
          distance_km: clientRes.safe_route.distance_km,
          avg_risk: clientRes.safe_route.avg_risk,
          corridors: clientRes.safe_route.corridors,
        };
        const shortest: RouteOverlay = {
          coordinates: clientRes.shortest_route.coordinates,
          distance_km: clientRes.shortest_route.distance_km,
          avg_risk: clientRes.shortest_route.avg_risk,
          corridors: clientRes.shortest_route.corridors,
        };

        setLastResult({
          safe,
          shortest,
          riskReductionPct: clientRes.risk_reduction_pct,
        });
        onRouteCalculated(safe, shortest, originHub.coords, destHub.coords);
      }
    } finally {
      setIsCalculating(false);
    }
  };

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
            onChange={(e) => setOriginId(e.target.value)}
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
            onChange={(e) => setDestId(e.target.value)}
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
            onChange={(e) => setAvoidRiskThreshold(parseFloat(e.target.value))}
            className={styles.rangeSlider}
          />
          <div className={styles.sliderLabels}>
            <span>Strict (40%)</span>
            <span>Balanced (70%)</span>
            <span>Permissive (90%)</span>
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
        </div>
      )}
    </div>
  );
}
