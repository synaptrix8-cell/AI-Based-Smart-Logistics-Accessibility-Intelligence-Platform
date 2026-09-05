"use client";

import { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Polygon,
  Popup,
  Tooltip,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  EAST_KHASI_HILLS_SEGMENTS,
  EAST_KHASI_HILLS_BOUNDARY,
  RoadSegmentData,
  getRiskColor,
} from "@/lib/data/road-segments";
import { createClient } from "@/lib/supabase/client";
import styles from "./map.module.css";

// Fix standard Leaflet default icon issues in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface RouteOverlay {
  coordinates: [number, number][]; // [lat, lng]
  distance_km: number;
  avg_risk: number;
  corridors: string[];
}

interface RiskMapProps {
  selectedSegmentId?: string | null;
  onSelectSegment?: (segment: RoadSegmentData | null) => void;
  safeRoute?: RouteOverlay | null;
  shortestRoute?: RouteOverlay | null;
  originHubCoords?: [number, number] | null;
  destHubCoords?: [number, number] | null;
  filterRiskLevel?: string;
}

function MapViewController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function RiskMap({
  selectedSegmentId,
  onSelectSegment,
  safeRoute,
  shortestRoute,
  originHubCoords,
  destHubCoords,
  filterRiskLevel = "ALL",
}: RiskMapProps) {
  const [segments, setSegments] = useState<RoadSegmentData[]>(EAST_KHASI_HILLS_SEGMENTS);
  const [isClient, setIsClient] = useState(false);
  const [activeRealtimeUpdates, setActiveRealtimeUpdates] = useState(0);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch latest risk scores from Supabase on mount
  useEffect(() => {
    async function loadLatestRiskScores() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("risk_scores")
          .select("segment_id, score")
          .order("computed_at", { ascending: false });

        if (data && data.length > 0 && !error) {
          // Map latest score per segment
          const latestScoreMap = new Map<string, number>();
          data.forEach((row: any) => {
            if (!latestScoreMap.has(row.segment_id)) {
              latestScoreMap.set(row.segment_id, row.score);
            }
          });

          setSegments((prev) =>
            prev.map((s) => {
              const liveScore = latestScoreMap.get(s.id);
              if (liveScore !== undefined) {
                return {
                  ...s,
                  risk_score: liveScore,
                  risk_level:
                    liveScore < 0.4 ? "LOW" : liveScore < 0.7 ? "MEDIUM" : "HIGH",
                };
              }
              return s;
            })
          );
        }
      } catch (err) {
        console.warn("Using offline road segments data:", err);
      }
    }
    loadLatestRiskScores();
  }, []);

  // Supabase Realtime subscription for road updates & risk changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("live_road_risk_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "risk_scores" },
        (payload) => {
          setActiveRealtimeUpdates((prev) => prev + 1);
          if (payload.new && (payload.new as any).segment_id) {
            const updatedId = (payload.new as any).segment_id;
            const newScore = (payload.new as any).score;
            setSegments((prev) =>
              prev.map((s) => {
                if (s.id === updatedId) {
                  return {
                    ...s,
                    risk_score: newScore,
                    risk_level:
                      newScore < 0.4 ? "LOW" : newScore < 0.7 ? "MEDIUM" : "HIGH",
                  };
                }
                return s;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isClient) {
    return (
      <div className={styles.mapLoading}>
        <div className={styles.mapSpinner} />
        <p>Initializing East Khasi Hills GIS Network...</p>
      </div>
    );
  }

  // Filter segments
  const displayedSegments = segments.filter((s) => {
    if (filterRiskLevel === "ALL") return true;
    if (filterRiskLevel === "HIGH") return s.risk_score >= 0.7;
    if (filterRiskLevel === "MEDIUM") return s.risk_score >= 0.4 && s.risk_score < 0.7;
    if (filterRiskLevel === "LOW") return s.risk_score < 0.4;
    return true;
  });

  const centerCoords: [number, number] = [25.5788, 91.8933]; // Shillong

  return (
    <div className={styles.mapWrapper}>
      {/* Realtime Pulse Badge */}
      <div className={styles.realtimeBadge}>
        <span className={styles.livePulse} />
        <span>Supabase Realtime GIS Active</span>
        {activeRealtimeUpdates > 0 && (
          <span className={styles.updateCounter}>({activeRealtimeUpdates} live updates)</span>
        )}
      </div>

      <MapContainer
        center={centerCoords}
        zoom={10}
        scrollWheelZoom={true}
        className={styles.leafletContainer}
      >
        <MapViewController center={centerCoords} zoom={10} />

        {/* Base Map Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        {/* District Boundary Polygon */}
        <Polygon
          positions={EAST_KHASI_HILLS_BOUNDARY}
          pathOptions={{
            color: "#0A6847",
            weight: 2,
            dashArray: "6, 8",
            fillColor: "#0A6847",
            fillOpacity: 0.04,
          }}
        >
          <Tooltip sticky>East Khasi Hills District Boundary (Meghalaya)</Tooltip>
        </Polygon>

        {/* Road Segments */}
        {displayedSegments.map((seg) => {
          // Convert [lng, lat] to Leaflet [lat, lng]
          const latLngs = seg.coordinates.map((c) => [c[1], c[0]] as [number, number]);
          const color = getRiskColor(seg.risk_score);
          const isSelected = selectedSegmentId === seg.id;

          return (
            <Polyline
              key={seg.id}
              positions={latLngs}
              pathOptions={{
                color: color,
                weight: isSelected ? 8 : seg.risk_score >= 0.7 ? 6 : 5,
                opacity: isSelected ? 1.0 : 0.85,
                lineCap: "round",
                lineJoin: "round",
              }}
              eventHandlers={{
                click: () => {
                  if (onSelectSegment) onSelectSegment(seg);
                },
              }}
            >
              <Tooltip sticky>
                <div className={styles.tooltipContent}>
                  <strong>{seg.name}</strong>
                  {seg.highway_ref && (
                    <span className={styles.highwayTag}>{seg.highway_ref}</span>
                  )}
                  <div>
                    Risk Score:{" "}
                    <span style={{ color, fontWeight: 700 }}>
                      {seg.risk_score.toFixed(2)} ({seg.risk_level})
                    </span>
                  </div>
                </div>
              </Tooltip>

              <Popup>
                <div className={styles.popupCard}>
                  <div className={styles.popupHeader}>
                    <h4>{seg.name}</h4>
                    {seg.highway_ref && (
                      <span className={styles.highwayBadge}>{seg.highway_ref}</span>
                    )}
                  </div>

                  <div className={styles.popupRiskRow}>
                    <span>Risk Index:</span>
                    <strong style={{ color }}>
                      {seg.risk_score.toFixed(2)} — {seg.risk_level}
                    </strong>
                  </div>

                  <div className={styles.factorsGrid}>
                    <div className={styles.factorItem}>
                      <span className={styles.factorLabel}>Rainfall:</span>
                      <span className={styles.factorVal}>
                        {seg.factors.rainfall_mm} mm/h
                      </span>
                    </div>
                    <div className={styles.factorItem}>
                      <span className={styles.factorLabel}>Terrain Slope:</span>
                      <span className={styles.factorVal}>{seg.factors.slope_deg}°</span>
                    </div>
                    <div className={styles.factorItem}>
                      <span className={styles.factorLabel}>Active Reports:</span>
                      <span className={styles.factorVal}>
                        {seg.factors.active_reports}
                      </span>
                    </div>
                    <div className={styles.factorItem}>
                      <span className={styles.factorLabel}>Corridor Length:</span>
                      <span className={styles.factorVal}>{seg.length_km} km</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Shortest Route Overlay (Orange Dashed) */}
        {shortestRoute && shortestRoute.coordinates.length > 1 && (
          <Polyline
            positions={shortestRoute.coordinates}
            pathOptions={{
              color: "#F97316",
              weight: 4,
              dashArray: "8, 10",
              opacity: 0.7,
            }}
          >
            <Tooltip sticky>Direct Shortest Route ({shortestRoute.distance_km} km, Risk: {shortestRoute.avg_risk})</Tooltip>
          </Polyline>
        )}

        {/* AI Safe Route Overlay (Cyan/Green Glow) */}
        {safeRoute && safeRoute.coordinates.length > 1 && (
          <Polyline
            positions={safeRoute.coordinates}
            pathOptions={{
              color: "#06B6D4",
              weight: 7,
              opacity: 0.95,
            }}
          >
            <Tooltip sticky>
              🛡️ Setu AI Safe Route ({safeRoute.distance_km} km, Risk: {safeRoute.avg_risk})
            </Tooltip>
          </Polyline>
        )}

        {/* Origin Marker */}
        {originHubCoords && (
          <CircleMarker
            center={originHubCoords}
            radius={9}
            pathOptions={{
              color: "#16A34A",
              fillColor: "#22C55E",
              fillOpacity: 0.9,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top">🟢 Route Origin</Tooltip>
          </CircleMarker>
        )}

        {/* Destination Marker */}
        {destHubCoords && (
          <CircleMarker
            center={destHubCoords}
            radius={9}
            pathOptions={{
              color: "#1D4ED8",
              fillColor: "#3B82F6",
              fillOpacity: 0.9,
              weight: 3,
            }}
          >
            <Tooltip permanent direction="top">📍 Route Destination</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      {/* Map Legend */}
      <div className={styles.mapLegend}>
        <div className={styles.legendTitle}>Corridor Risk Index</div>
        <div className={styles.legendItems}>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: "#22C55E" }} />
            <span>Low (&lt; 0.40)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: "#F59E0B" }} />
            <span>Medium (0.40 - 0.70)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: "#EF4444" }} />
            <span>High (&ge; 0.70)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
