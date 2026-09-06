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
  Marker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  EAST_KHASI_HILLS_SEGMENTS,
  EAST_KHASI_HILLS_BOUNDARY,
  KEY_HUBS,
  KeyHub,
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
  onSelectHubAsOrigin?: (hub: KeyHub) => void;
  onSelectHubAsDest?: (hub: KeyHub) => void;
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
  onSelectHubAsOrigin,
  onSelectHubAsDest,
}: RiskMapProps) {
  const [segments, setSegments] = useState<RoadSegmentData[]>(EAST_KHASI_HILLS_SEGMENTS);
  const [isClient, setIsClient] = useState(false);
  const [activeRealtimeUpdates, setActiveRealtimeUpdates] = useState(0);
  const [showExplainer, setShowExplainer] = useState(false);
  const [showTownHubs, setShowTownHubs] = useState(true);
  const [showHazardPins, setShowHazardPins] = useState(true);
  const [corridorDisplay, setCorridorDisplay] = useState<"ALL" | "HAZARDS" | "OFF">("ALL");

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

  // Filter segments based on corridor display mode
  const displayedSegments = corridorDisplay === "OFF" ? [] : segments.filter((s) => {
    // First apply corridor display filter
    if (corridorDisplay === "HAZARDS" && s.risk_score < 0.7) return false;
    // Then apply risk level filter
    if (filterRiskLevel === "ALL") return true;
    if (filterRiskLevel === "HIGH") return s.risk_score >= 0.7;
    if (filterRiskLevel === "MEDIUM") return s.risk_score >= 0.4 && s.risk_score < 0.7;
    if (filterRiskLevel === "LOW") return s.risk_score < 0.4;
    return true;
  });

  const highHazardSegments = segments.filter((s) => s.risk_score >= 0.7);
  const centerCoords: [number, number] = [25.5788, 91.8933]; // Shillong

  return (
    <div className={styles.mapWrapper}>
      {/* Map Quick Filter Pill Controls */}
      <div className={styles.mapQuickControls}>
        <button
          type="button"
          className={`${styles.controlPill} ${showTownHubs ? styles.activeControlPill : ""}`}
          onClick={() => setShowTownHubs(!showTownHubs)}
          title="Toggle Town & Logistics Hub Labels"
        >
          {showTownHubs ? "🏛️ Town Hubs: ON" : "🏛️ Hubs: OFF"}
        </button>
        <button
          type="button"
          className={`${styles.controlPill} ${showHazardPins ? styles.activeControlPill : ""}`}
          onClick={() => setShowHazardPins(!showHazardPins)}
          title="Toggle Hazard Alert Warnings"
        >
          {showHazardPins ? `⚠️ Hazards (${highHazardSegments.length})` : "⚠️ Hazards: OFF"}
        </button>
        <button
          type="button"
          className={`${styles.controlPill} ${corridorDisplay !== "OFF" ? styles.activeControlPill : ""}`}
          onClick={() => {
            const modes: ("ALL" | "HAZARDS" | "OFF")[] = ["ALL", "HAZARDS", "OFF"];
            const idx = modes.indexOf(corridorDisplay);
            setCorridorDisplay(modes[(idx + 1) % modes.length]);
          }}
          title="Toggle corridor layer visibility"
        >
          {corridorDisplay === "ALL"
            ? "🛣️ Corridors: ALL"
            : corridorDisplay === "HAZARDS"
            ? "🛣️ Corridors: HAZARDS"
            : "🛣️ Corridors: OFF"}
        </button>
      </div>

      {/* Realtime Pulse Badge */}
      <div className={styles.realtimeBadge}>
        <span className={styles.livePulse} />
        <span>Supabase Realtime GIS Active</span>
        {activeRealtimeUpdates > 0 && (
          <span className={styles.updateCounter}>({activeRealtimeUpdates} updates)</span>
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
          const latLngs = seg.coordinates.map((c) => [c[1], c[0]] as [number, number]);
          const color = getRiskColor(seg.risk_score);
          const isSelected = selectedSegmentId === seg.id;
          const isHighRisk = seg.risk_score >= 0.7;
          const isMediumRisk = seg.risk_score >= 0.4 && seg.risk_score < 0.7;

          return (
            <Polyline
              key={seg.id}
              positions={latLngs}
              pathOptions={{
                color: color,
                weight: isSelected ? 8 : isHighRisk ? 6 : 5,
                opacity: isSelected ? 1.0 : 0.88,
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
                    Safety Status:{" "}
                    <span style={{ color, fontWeight: 700 }}>
                      {isHighRisk
                        ? "🔴 HAZARDOUS / HIGH SLIP RISK"
                        : isMediumRisk
                        ? "🟡 CAUTION / WET GRADE"
                        : "🟢 CLEAR & PASSABLE"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#64748B" }}>
                    Risk Index: {seg.risk_score.toFixed(2)} | Rain: {seg.factors.rainfall_mm} mm/h | Slope: {seg.factors.slope_deg}°
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
                    <span>Passability Status:</span>
                    <strong style={{ color }}>
                      {isHighRisk
                        ? "🔴 Severe Hazard / Reroute"
                        : isMediumRisk
                        ? "🟡 Drive With Caution"
                        : "🟢 Safe for All Freight"}
                    </strong>
                  </div>

                  <div className={styles.factorsGrid}>
                    <div className={styles.factorItem}>
                      <span className={styles.factorLabel}>Current Rain:</span>
                      <span className={styles.factorVal}>{seg.factors.rainfall_mm} mm/h</span>
                    </div>
                    <div className={styles.factorItem}>
                      <span className={styles.factorLabel}>Terrain Slope:</span>
                      <span className={styles.factorVal}>{seg.factors.slope_deg}° steep</span>
                    </div>
                    <div className={styles.factorItem}>
                      <span className={styles.factorLabel}>Field Flags:</span>
                      <span className={styles.factorVal}>{seg.factors.active_reports} reports</span>
                    </div>
                    <div className={styles.factorItem}>
                      <span className={styles.factorLabel}>Length:</span>
                      <span className={styles.factorVal}>{seg.length_km} km</span>
                    </div>
                  </div>

                  <div style={{ marginTop: "8px", fontSize: "0.72rem", color: "#475569" }}>
                    {isHighRisk
                      ? "⚠️ Geotechnical Advisory: Extreme slope + saturated soil. Multi-axle trucks must use alternate bypass."
                      : isMediumRisk
                      ? "⚡ Monsoon Advisory: Pavement wet, reduced traction. Keep speed under 35 km/h."
                      : "✅ All clear: Road surface stable. Suitable for standard logistical transport."}
                  </div>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* Pulsing Hazard Warning Pins on High-Risk Roads */}
        {showHazardPins &&
          highHazardSegments.map((seg) => {
            const midIdx = Math.floor(seg.coordinates.length / 2);
            const pt = seg.coordinates[midIdx];
            const hazardCoords: [number, number] = [pt[1], pt[0]];

            const hazardIcon = L.divIcon({
              className: "hazard-pin-icon",
              html: `<div class="${styles.hazardPin}">⚠️</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });

            return (
              <Marker key={`hazard-${seg.id}`} position={hazardCoords} icon={hazardIcon}>
                <Popup>
                  <div className={styles.popupCard} style={{ maxWidth: "240px" }}>
                    <h4 style={{ color: "#EF4444", margin: "0 0 4px 0", fontSize: "0.85rem" }}>
                      ⚠️ Active Hazard Zone
                    </h4>
                    <p style={{ margin: "0 0 6px 0", fontSize: "0.75rem", fontWeight: 700 }}>
                      {seg.name} ({seg.highway_ref})
                    </p>
                    <p style={{ margin: "0 0 6px 0", fontSize: "0.72rem", color: "#475569" }}>
                      Risk Index: <strong style={{ color: "#EF4444" }}>{seg.risk_score.toFixed(2)}</strong>.
                      Heavy rainfall ({seg.factors.rainfall_mm} mm/h) on a {seg.factors.slope_deg}° mountain grade.
                    </p>
                    <div style={{ fontSize: "0.7rem", background: "#FEF2F2", padding: "6px", borderRadius: "4px", color: "#991B1B" }}>
                      ⚡ Reroute Recommended: AI Safe Route automatically routes around this corridor.
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Interactive Town / Logistics Hub Markers */}
        {showTownHubs &&
          KEY_HUBS.map((hub) => {
            const hubIcon = L.divIcon({
              className: "hub-marker-icon",
              html: `<div class="${styles.hubMarkerCard}">
                <span class="${styles.hubEmoji}">${hub.icon || "📍"}</span>
                <span class="${styles.hubText}">${hub.name.split(" ")[0]}</span>
              </div>`,
              iconSize: [80, 26],
              iconAnchor: [40, 13],
            });

            return (
              <Marker key={hub.id} position={hub.coords} icon={hubIcon}>
                <Popup>
                  <div className={styles.popupCard} style={{ minWidth: "200px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "1.2rem" }}>{hub.icon || "🏛️"}</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "0.85rem" }}>{hub.name}</h4>
                        <span style={{ fontSize: "0.68rem", color: "#64748B" }}>
                          {hub.role} • {hub.elevation_m}m elevation
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          borderRadius: "4px",
                          border: "1px solid #16A34A",
                          background: "#DCFCE7",
                          color: "#166534",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          if (onSelectHubAsOrigin) onSelectHubAsOrigin(hub);
                        }}
                      >
                        Start Here 🟢
                      </button>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          borderRadius: "4px",
                          border: "1px solid #2563EB",
                          background: "#DBEAFE",
                          color: "#1E40AF",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          if (onSelectHubAsDest) onSelectHubAsDest(hub);
                        }}
                      >
                        Destination 📍
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
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
              opacity: 0.75,
            }}
          >
            <Tooltip sticky>
              Direct Shortest Road ({shortestRoute.distance_km} km, Exposure Risk: {shortestRoute.avg_risk})
            </Tooltip>
          </Polyline>
        )}

        {/* AI Safe Route Overlay — Dual-layer GPS navigation styling */}
        {safeRoute && safeRoute.coordinates.length > 1 && (
          <>
            {/* Outer dark casing for high contrast against OpenStreetMap */}
            <Polyline
              positions={safeRoute.coordinates}
              pathOptions={{
                color: "#0F172A",
                weight: 9,
                opacity: 0.85,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            {/* Core electric navigation track */}
            <Polyline
              positions={safeRoute.coordinates}
              pathOptions={{
                color: "#0284C7",
                weight: 5,
                opacity: 1.0,
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Tooltip sticky>
                <div style={{ fontFamily: "sans-serif", fontSize: "0.78rem" }}>
                  <strong>🛡️ Setu AI Safe Route</strong> ({safeRoute.distance_km} km)
                  <div style={{ color: "#0284C7", fontWeight: 700 }}>
                    🛣️ Verified Paved Highway • Hazard Bypass Active
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#64748B" }}>
                    Click route for vehicle passability advisory
                  </div>
                </div>
              </Tooltip>
              <Popup>
                <div style={{ minWidth: "220px", fontFamily: "sans-serif", fontSize: "0.75rem", padding: "2px" }}>
                  <h4 style={{ margin: "0 0 6px 0", color: "#0A6847", fontSize: "0.85rem" }}>
                    🛡️ AI Safe Freight Route (Verified)
                  </h4>
                  <div style={{ marginBottom: "6px" }}>
                    <strong>Paved Corridors:</strong>
                    <div style={{ color: "#334155", fontWeight: 600 }}>
                      {safeRoute.corridors && safeRoute.corridors.length > 0
                        ? safeRoute.corridors.join(" → ")
                        : "NH 6 → SH 5 All-Weather Highway"}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", background: "#F8FAFC", padding: "6px", borderRadius: "6px" }}>
                    <div>
                      <span style={{ color: "#64748B", fontSize: "0.68rem" }}>Total Distance</span>
                      <div style={{ fontWeight: 800, color: "#0F172A" }}>{safeRoute.distance_km} km</div>
                    </div>
                    <div>
                      <span style={{ color: "#64748B", fontSize: "0.68rem" }}>Safety Rating</span>
                      <div style={{ fontWeight: 800, color: "#16A34A" }}>
                        {((1 - safeRoute.avg_risk) * 100).toFixed(0)}% Safe
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", padding: "6px 8px", borderRadius: "6px", color: "#166534", fontSize: "0.7rem" }}>
                    <strong>🚚 Vehicle Status:</strong> 100% Passable for heavy multi-axle freight trucks, medical vans, and essential relief transport.
                  </div>
                </div>
              </Popup>
            </Polyline>
          </>
        )}

        {/* Origin Vehicle Marker */}
        {originHubCoords && (
          <Marker
            position={originHubCoords}
            icon={L.divIcon({
              className: "origin-truck-icon",
              html: `<div style="background: #16A34A; color: white; border: 2px solid white; border-radius: 20px; padding: 2px 8px; font-size: 0.72rem; font-weight: 800; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; transform: translate(-50%, -50%);">
                <span>🚚</span><span>Start</span>
              </div>`,
              iconSize: [64, 24],
              iconAnchor: [32, 12],
            })}
          >
            <Tooltip permanent direction="top">🟢 Route Origin (Freight Departure)</Tooltip>
          </Marker>
        )}

        {/* Destination Target Marker */}
        {destHubCoords && (
          <Marker
            position={destHubCoords}
            icon={L.divIcon({
              className: "dest-flag-icon",
              html: `<div style="background: #1D4ED8; color: white; border: 2px solid white; border-radius: 20px; padding: 2px 8px; font-size: 0.72rem; font-weight: 800; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px; transform: translate(-50%, -50%);">
                <span>🏁</span><span>Destination</span>
              </div>`,
              iconSize: [96, 24],
              iconAnchor: [48, 12],
            })}
          >
            <Tooltip permanent direction="top">📍 Destination (Relief Hub)</Tooltip>
          </Marker>
        )}
      </MapContainer>

      {/* Sleek, Compact & Non-Intrusive Map Legend Bar */}
      <div className={styles.compactLegendBar}>
        <div className={styles.compactLegendItems}>
          <div className={styles.compactLegendItem}>
            <span className={styles.legendColorDot} style={{ background: "#22C55E" }} />
            <span>Safe</span>
          </div>
          <div className={styles.compactLegendItem}>
            <span className={styles.legendColorDot} style={{ background: "#F59E0B" }} />
            <span>Caution</span>
          </div>
          <div className={styles.compactLegendItem}>
            <span className={styles.legendColorDot} style={{ background: "#EF4444" }} />
            <span>Hazard</span>
          </div>
          <div className={styles.compactLegendDivider} />
          <div className={styles.compactLegendItem}>
            <span className={styles.legendColorLine} style={{ background: "#06B6D4" }} />
            <span>AI Safe</span>
          </div>
          <div className={styles.compactLegendItem}>
            <span className={styles.legendColorLine} style={{ background: "#F97316", borderTop: "2px dashed #F97316" }} />
            <span>Shortest</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.compactLegendBtn}
          onClick={() => setShowExplainer(!showExplainer)}
          title="Toggle corridor risk guide"
        >
          {showExplainer ? "✕ Close" : "ℹ️ Guide"}
        </button>

        {showExplainer && (
          <div className={styles.legendPopover}>
            <div className={styles.popoverTitle}>Road Safety & Routing Guide</div>
            <div className={styles.popoverRow}>
              <strong style={{ color: "#22C55E" }}>🟢 Clear & Safe:</strong> Passable for all freight vehicles.
            </div>
            <div className={styles.popoverRow}>
              <strong style={{ color: "#F59E0B" }}>🟡 Caution / Wet:</strong> Heavy rain or steep grade (&lt;35 km/h).
            </div>
            <div className={styles.popoverRow}>
              <strong style={{ color: "#EF4444" }}>🔴 Hazard / Blocked:</strong> Landslide or slope failure. Detour advised.
            </div>
            <div className={styles.popoverRow}>
              <strong style={{ color: "#06B6D4" }}>🛡️ Setu AI Safe Route:</strong> Geotechnically routed bypass avoiding hazards.
            </div>
            <div className={styles.popoverRow}>
              <strong style={{ color: "#F97316" }}>🟠 Direct Shortest:</strong> Shortest distance road (crosses hazards).
            </div>
            <div className={styles.popoverFormula}>
              <strong>Risk Weighting:</strong> 35% Rain + 25% Slope + 25% Incidents + 15% History.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
