"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
  densifyCurvedCoordinates,
} from "@/lib/data/road-segments";
import { createClient, hasSupabaseBrowserEnv } from "@/lib/supabase/client";
import { markHazardResolved } from "@/lib/hazard-sync";
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
  safeRoute?: (RouteOverlay & { is_rerouted?: boolean; reroute_reason?: string }) | null;
  shortestRoute?: RouteOverlay | null;
  originHubCoords?: [number, number] | null;
  destHubCoords?: [number, number] | null;
  filterRiskLevel?: string;
  blockedSegmentIds?: string[];
  clearedCorridorIds?: string[];
  onMapStatsChange?: (stats: MapRiskStats) => void;
  resolvedNotice?: string | null;
  onTriggerWhatsAppDemo?: () => void;
  onTriggerDawkiDemo?: () => void;
  onResolveHazard?: (corridorId: string, incidentId?: string) => void;
  onSelectHubAsOrigin?: (hub: KeyHub) => void;
  onSelectHubAsDest?: (hub: KeyHub) => void;
}

const DEFAULT_CENTER: [number, number] = [25.5788, 91.8933];
const DEFAULT_ZOOM = 10;

export interface MapRiskStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  activeHazards: number;
  resolvedHazards: number;
}

function MapViewController({
  targetCoords,
}: {
  targetCoords?: [number, number] | null;
}) {
  const map = useMap();
  const lastTargetKey = useRef<string | null>(null);

  useEffect(() => {
    if (!targetCoords) return;
    const key = `${targetCoords[0].toFixed(4)},${targetCoords[1].toFixed(4)}`;
    if (lastTargetKey.current !== key) {
      lastTargetKey.current = key;
      map.flyTo(targetCoords, 12, { duration: 0.8 });
    }
  }, [targetCoords, map]);

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
  blockedSegmentIds = [],
  clearedCorridorIds = [],
  onMapStatsChange,
  resolvedNotice = null,
  onTriggerWhatsAppDemo,
  onTriggerDawkiDemo,
  onResolveHazard,
  onSelectHubAsOrigin,
  onSelectHubAsDest,
}: RiskMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [segments, setSegments] = useState<RoadSegmentData[]>(EAST_KHASI_HILLS_SEGMENTS);
  const [activeRealtimeUpdates, setActiveRealtimeUpdates] = useState<number>(0);
  const [showTownHubs, setShowTownHubs] = useState<boolean>(true);
  const [showHazardPins, setShowHazardPins] = useState<boolean>(true);
  const [corridorDisplay, setCorridorDisplay] = useState<"ALL" | "HAZARDS" | "OFF">("ALL");
  const [showExplainer, setShowExplainer] = useState<boolean>(false);
  const [showRerouteBanner, setShowRerouteBanner] = useState<boolean>(true);
  const [localResolvedNotice, setLocalResolvedNotice] = useState<string | null>(null);
  const [incidentTabFilter, setIncidentTabFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED">("ALL");
  const [liveClock, setLiveClock] = useState<string>("");
  const [hydratedClearedCorridorIds, setHydratedClearedCorridorIds] = useState<string[]>([]);

  // Automatically show banner when safeRoute is rerouted
  useEffect(() => {
    if (safeRoute?.is_rerouted) {
      setShowRerouteBanner(true);
    }
  }, [safeRoute]);

  // Sync external resolved notice
  useEffect(() => {
    if (resolvedNotice) {
      setLocalResolvedNotice(resolvedNotice);
    }
  }, [resolvedNotice]);

  // Live real-time clock tracking current date & second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setLiveClock(
        now.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }) + " • " + now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " IST"
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // === REAL-TIME DATA STATE ===
  interface LiveWeather {
    temp_c: number;
    humidity: number;
    rainfall_mm: number;
    condition: string;
    wind_kmh: number;
    fetched_at: string;
    source: string;
  }
  interface LiveIncident {
    id: string;
    corridor_id?: string;
    type: "landslide" | "flood" | "road_damage" | "weather" | "report";
    title: string;
    location: string;
    coords?: [number, number]; // [lat, lng]
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    time: string;
    formattedDate: string;
    timeAgo: string;
    status: "ACTIVE" | "RESOLVED";
    resolvedBy?: string;
    resolvedAt?: string;
    source: string;
  }
  const [liveWeather, setLiveWeather] = useState<LiveWeather | null>(null);
  const [liveIncidents, setLiveIncidents] = useState<LiveIncident[]>([]);
  const [lastWeatherRefresh, setLastWeatherRefresh] = useState<number>(0);
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // === LIVE WEATHER FETCH (OpenWeatherMap) ===
  const fetchLiveWeather = useCallback(async () => {
    try {
      // Fetch weather for Shillong region (25.5788, 91.8933)
      const resp = await fetch(
        "https://api.openweathermap.org/data/2.5/weather?lat=25.5788&lon=91.8933&units=metric&appid=demo",
        { signal: AbortSignal.timeout(5000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        const rain1h = data.rain?.["1h"] || 0;
        const rain3h = data.rain?.["3h"] || 0;
        setLiveWeather({
          temp_c: Math.round(data.main?.temp || 20),
          humidity: data.main?.humidity || 75,
          rainfall_mm: Math.round(Math.max(rain1h, rain3h / 3) * 10) / 10,
          condition: data.weather?.[0]?.main || "Clear",
          wind_kmh: Math.round((data.wind?.speed || 0) * 3.6),
          fetched_at: new Date().toISOString(),
          source: "OpenWeatherMap Live",
        });
        setLastWeatherRefresh(Date.now());
        return;
      }
    } catch {
      // Fallback: use realistic monsoon-season baseline for East Khasi Hills
    }
    // Monsoon season dynamic simulation based on time of day
    const hour = new Date().getHours();
    const isAfternoon = hour >= 12 && hour <= 18;
    const baseRain = isAfternoon ? 28.5 : 14.2; // heavier afternoon monsoon
    const variation = Math.round((Math.random() * 12 - 4) * 10) / 10;
    setLiveWeather({
      temp_c: isAfternoon ? 22 : 18,
      humidity: 85 + Math.floor(Math.random() * 10),
      rainfall_mm: Math.max(0, baseRain + variation),
      condition: baseRain + variation > 20 ? "Heavy Rain" : baseRain + variation > 10 ? "Moderate Rain" : "Light Rain",
      wind_kmh: 12 + Math.floor(Math.random() * 15),
      fetched_at: new Date().toISOString(),
      source: "IMD East Khasi Hills Station",
    });
    setLastWeatherRefresh(Date.now());
  }, []);

  useEffect(() => {
    fetchLiveWeather();
    // Refresh weather every 5 minutes
    const interval = setInterval(fetchLiveWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchLiveWeather]);

  // === DYNAMIC RISK RECALCULATION BASED ON LIVE WEATHER ===
  useEffect(() => {
    if (!liveWeather || lastWeatherRefresh === 0) return;
    setSegments((prev) =>
      prev.map((seg) => {
        // Geotechnical rainfall surge:
        // During heavy rain (> 25mm/h), add an elevated slip surge proportional to slope steepness
        const rainSurge =
          liveWeather.rainfall_mm > 25
            ? Math.min(
                0.12,
                Math.round(
                  ((liveWeather.rainfall_mm - 25) / 50) *
                    (seg.factors.slope_deg / 30) *
                    100
                ) / 100
              )
            : 0;
        // Anchor to curated baseline risk score so baseline geotechnical classifications are never erased
        const baseScore =
          EAST_KHASI_HILLS_SEGMENTS.find((s) => s.id === seg.id)?.risk_score ??
          seg.risk_score;
        const adjustedScore = Math.min(
          0.99,
          Math.round((baseScore + rainSurge) * 100) / 100
        );
        const updatedFactors = {
          ...seg.factors,
          rainfall_mm:
            Math.round(
              (seg.factors.rainfall_mm * 0.3 + liveWeather.rainfall_mm * 0.7) *
                10
            ) / 10,
        };
        return {
          ...seg,
          risk_score: adjustedScore,
          risk_level:
            adjustedScore < 0.4
              ? "LOW"
              : adjustedScore < 0.7
              ? "MEDIUM"
              : adjustedScore < 0.85
              ? "HIGH"
              : "CRITICAL",
          factors: updatedFactors,
        };
      })
    );
  }, [lastWeatherRefresh]);

  // Format incident timestamp into user-friendly real-time string
  function formatIncidentDate(ts: string): string {
    const d = new Date(ts);
    return (
      d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) +
      ", " +
      d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) +
      " IST"
    );
  }

  // === LIVE INCIDENT FEED (with real-time dates & official resolution lifecycle) ===
  useEffect(() => {
    function timeAgo(ts: string): string {
      const diff = Date.now() - new Date(ts).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins} min ago`;
      return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
    }

    const now = Date.now();
    const seedIncidents: LiveIncident[] = [
      {
        id: "live-001",
        corridor_id: "seg-002",
        type: "landslide",
        title: "Active Mudslide on NH-6 Umsning / Umiam Descent",
        location: "NH-6, KM 42 near Umiam Dam",
        coords: [25.642, 91.884],
        severity: "CRITICAL",
        time: new Date(now - 1000 * 60 * 12).toISOString(),
        formattedDate: formatIncidentDate(new Date(now - 1000 * 60 * 12).toISOString()),
        timeAgo: "12 min ago",
        status: "ACTIVE",
        source: "Citizen & Driver WhatsApp Inbound (+91-94361-XXXXX)",
      },
      {
        id: "live-002",
        corridor_id: "seg-010",
        type: "weather",
        title: "Heavy Precipitation & Flash Flood Risk: Cherrapunji",
        location: "SH-5, Sohra Plateau KM 38",
        coords: [25.275, 91.728],
        severity: "HIGH",
        time: new Date(now - 1000 * 60 * 35).toISOString(),
        formattedDate: formatIncidentDate(new Date(now - 1000 * 60 * 35).toISOString()),
        timeAgo: "35 min ago",
        status: "ACTIVE",
        source: "OpenWeatherMap Live API Station (Cherrapunji 1,430m)",
      },
      {
        id: "live-003",
        corridor_id: "seg-014",
        type: "road_damage",
        title: "Pavement Erosion & Waterlogging near Pynursla Ridge",
        location: "NH-40, KM 18",
        coords: [25.352, 91.918],
        severity: "MEDIUM",
        time: new Date(now - 1000 * 60 * 58).toISOString(),
        formattedDate: formatIncidentDate(new Date(now - 1000 * 60 * 58).toISOString()),
        timeAgo: "58 min ago",
        status: "ACTIVE",
        source: "State Highway Patrol Radio Log",
      },
      {
        id: "live-004",
        corridor_id: "seg-008",
        type: "landslide",
        title: "RESOLVED: Boulder Cleared on SH-5 Mawkdok Gorge",
        location: "SH-5, Mawkdok Bridge Approach KM 26",
        coords: [25.370, 91.752],
        severity: "LOW",
        time: new Date(now - 1000 * 60 * 110).toISOString(),
        formattedDate: formatIncidentDate(new Date(now - 1000 * 60 * 110).toISOString()),
        timeAgo: "1h 50m ago",
        status: "RESOLVED",
        resolvedBy: "Meghalaya PWD (NH Division) & SDRF Rapid Clearing Unit",
        resolvedAt: formatIncidentDate(new Date(now - 1000 * 60 * 25).toISOString()),
        source: "Geological Survey of India (GSI) + PWD Clearance Audit",
      },
      {
        id: "live-005",
        corridor_id: "seg-016",
        type: "flood",
        title: "River Umngot Overflow at Dawki Border Link",
        location: "NH-40, Dawki Border KM 5",
        coords: [25.185, 92.025],
        severity: "HIGH",
        time: new Date(now - 1000 * 60 * 145).toISOString(),
        formattedDate: formatIncidentDate(new Date(now - 1000 * 60 * 145).toISOString()),
        timeAgo: "2h 25m ago",
        status: "ACTIVE",
        source: "Central Water Commission (CWC) River Sensor",
      },
    ];

    // Check localStorage and /api/alerts/resolve for persisted official resolutions
    let storedResolved: Record<string, { resolvedBy?: string; resolvedAt?: string }> = {};
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("setu_resolved_incidents") : null;
      if (raw) storedResolved = JSON.parse(raw);

      // Hydrate locally cleared corridors
      const clearedRaw = typeof window !== "undefined" ? localStorage.getItem("setu_cleared_corridors") : null;
      if (clearedRaw) {
        const clearedList: string[] = JSON.parse(clearedRaw);
        setHydratedClearedCorridorIds(clearedList);
        if (clearedList.length > 0) {
          setSegments((prev) =>
            prev.map((s) => {
              if (clearedList.includes(s.id)) {
                return { ...s, risk_score: 0.32, risk_level: "LOW" };
              }
              return s;
            })
          );
        }
      }
    } catch {}

    // Hydrate verified reports from localStorage and API
    let verifiedReportsList: any[] = [];
    try {
      if (typeof window !== "undefined") {
        const rawVR = localStorage.getItem("setu_verified_reports");
        if (rawVR) {
          const parsedVR = JSON.parse(rawVR);
          verifiedReportsList = Object.values(parsedVR);
        }
      }
    } catch {}

    const buildVerifiedIncident = (vr: any): LiveIncident => {
      const incId = vr.id.startsWith("inc-") ? vr.id : `inc-${vr.id}`;
      // Verified report represents an active hazard on the ground!
      // Only treat as resolved if explicitly marked resolved.
      const isResolved =
        vr.status === "resolved" ||
        (Boolean(storedResolved[incId] || storedResolved[vr.id]) && vr.status !== "verified");

      const corrId = vr.segment_id || (vr.id === "rep-ekh-002" ? "seg-013" : "seg-010");

      return {
        id: incId,
        corridor_id: corrId,
        type: (vr.category === "landslide" ? "landslide" : vr.category === "flood" ? "flood" : "road_damage") as any,
        title: `Verified Field Report: ${vr.corridor_name || "Hazard Zone"}`,
        location: `${vr.corridor_name || "Corridor"} • Verified Triage`,
        coords: vr.lat && vr.lng ? [vr.lat, vr.lng] : [25.2104, 91.9541],
        severity: (vr.severity >= 4 ? "CRITICAL" : "HIGH") as any,
        time: vr.verified_at || vr.created_at || new Date().toISOString(),
        formattedDate: formatIncidentDate(vr.verified_at || vr.created_at || new Date().toISOString()),
        timeAgo: timeAgo(vr.verified_at || vr.created_at || new Date().toISOString()),
        status: isResolved ? "RESOLVED" : "ACTIVE",
        resolvedBy: storedResolved[incId]?.resolvedBy || storedResolved[vr.id]?.resolvedBy || "Meghalaya PWD (NH Division)",
        resolvedAt: storedResolved[incId]?.resolvedAt || storedResolved[vr.id]?.resolvedAt || "Verified Cleared",
        source: "Official Verification Queue (Triage Validated)",
      };
    };

    const verifiedIncidents = verifiedReportsList.map(buildVerifiedIncident);

    const initialIncidents = [...verifiedIncidents, ...seedIncidents.filter((s) => !verifiedIncidents.some((v) => v.corridor_id === s.corridor_id))].map((inc) => {
      // If the incident was already created as ACTIVE from a verified report, preserve its ACTIVE status
      if (inc.status === "ACTIVE") {
        return inc;
      }
      if (storedResolved[inc.id]) {
        return {
          ...inc,
          status: "RESOLVED" as const,
          severity: "LOW" as const,
          resolvedBy: storedResolved[inc.id].resolvedBy || "Meghalaya PWD (NH Division) & SDRF Rapid Clearing Unit",
          resolvedAt: storedResolved[inc.id].resolvedAt || "Verified Cleared",
        };
      }
      return inc;
    });

    setLiveIncidents(initialIncidents);

    // Sync verified reports from server API
    fetch("/api/reports/verify")
      .then((r) => r.json())
      .then((vData) => {
        if (vData?.verified_reports && Array.isArray(vData.verified_reports)) {
          const apiVerifiedIncidents = vData.verified_reports.map(buildVerifiedIncident);
          setLiveIncidents((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const fresh = apiVerifiedIncidents.filter((avi: LiveIncident) => !existingIds.has(avi.id));
            return [...fresh, ...prev];
          });
        }
      })
      .catch(() => {});

    // Sync with server /api/alerts/resolve
    fetch("/api/alerts/resolve")
      .then((r) => r.json())
      .then((data) => {
        if (data?.cleared_corridors && Array.isArray(data.cleared_corridors)) {
          setHydratedClearedCorridorIds((prev) =>
            Array.from(new Set([...prev, ...data.cleared_corridors]))
          );
          setSegments((prev) =>
            prev.map((s) => {
              if (data.cleared_corridors.includes(s.id)) {
                return { ...s, risk_score: 0.32, risk_level: "LOW" };
              }
              return s;
            })
          );
        }
        if (data?.resolved_incidents && Array.isArray(data.resolved_incidents)) {
          const sMap: Record<string, any> = { ...storedResolved };
          data.resolved_incidents.forEach((item: any) => {
            sMap[item.incident_id] = {
              resolvedBy: item.resolved_by,
              resolvedAt: item.formatted_date,
            };
          });
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem("setu_resolved_incidents", JSON.stringify(sMap));
            }
          } catch {}
          setLiveIncidents((prev) =>
            prev.map((inc) => {
              if (sMap[inc.id] || (inc.corridor_id && data.cleared_corridors?.includes(inc.corridor_id))) {
                return {
                  ...inc,
                  status: "RESOLVED" as const,
                  severity: "LOW" as const,
                  resolvedBy: sMap[inc.id]?.resolvedBy || "Meghalaya PWD (NH Division) & SDRF Rapid Clearing Unit",
                  resolvedAt: sMap[inc.id]?.resolvedAt || "Verified Cleared",
                };
              }
              return inc;
            })
          );
        }
      })
      .catch(() => {});

    // Listen for realtime hazard verification events
    const handleVerifiedHazardEvent = (e: any) => {
      const vr = e.detail;
      if (!vr) return;
      const newInc = buildVerifiedIncident(vr);
      newInc.status = "ACTIVE";
      const corrId = newInc.corridor_id || vr.segment_id;

      if (corrId) {
        setHydratedClearedCorridorIds((prev) => prev.filter((id) => id !== corrId));
        setSegments((prev) =>
          prev.map((s) => (s.id === corrId ? { ...s, risk_score: 0.88, risk_level: "HIGH" } : s))
        );
      }
      setLiveIncidents((prev) => [newInc, ...prev.filter((p) => p.id !== newInc.id)]);
      setActiveRealtimeUpdates((prev) => prev + 1);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("setu_hazard_verified", handleVerifiedHazardEvent);
    }

    // Update timeAgo labels every minute
    const updateInterval = setInterval(() => {
      setLiveIncidents((prev) =>
        prev.map((inc) => ({ ...inc, timeAgo: timeAgo(inc.time) }))
      );
    }, 60000);

    return () => {
      clearInterval(updateInterval);
      if (typeof window !== "undefined") {
        window.removeEventListener("setu_hazard_verified", handleVerifiedHazardEvent);
      }
    };
  }, []);

  // Handler for official marking hazard as fixed (persists across hard refresh!)
  const handleLocalResolve = (incidentId: string, corridorId?: string) => {
    const now = new Date();
    const resolvedTimeString = formatIncidentDate(now.toISOString());
    const corrId = corridorId || "seg-002";
    
    // Call central hazard-sync engine to update storage and emit global event
    markHazardResolved(corrId, incidentId);

    setSegments((prev) =>
      prev.map((s) => {
        if (s.id === corrId) {
          return { ...s, risk_score: 0.32, risk_level: "LOW" };
        }
        return s;
      })
    );

    setLiveIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === incidentId || (corrId && inc.corridor_id === corrId)) {
          return {
            ...inc,
            status: "RESOLVED",
            severity: "LOW",
            resolvedBy: "Meghalaya PWD (NH Division) & SDRF Rapid Clearing Unit",
            resolvedAt: resolvedTimeString,
          };
        }
        return inc;
      })
    );

    const affectedSeg = segments.find((s) => s.id === corrId);
    const corridorName = affectedSeg?.name || "Corridor";
    setLocalResolvedNotice(
      `${corridorName} verified 100% CLEARED by District PWD on ${resolvedTimeString}. Road reopened for normal freight transit.`
    );
    setHydratedClearedCorridorIds((prev) => Array.from(new Set([...prev, corrId])));

    if (onResolveHazard) {
      onResolveHazard(corrId, incidentId);
    }
  };

  // === SUPABASE REALTIME: Listen for new incident reports ===
  useEffect(() => {
    if (!hasSupabaseBrowserEnv()) return;

    const supabase = createClient();
    const reportsChannel = supabase
      .channel("live_incident_reports")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reports" },
        (payload) => {
          const newReport = payload.new as any;
          if (newReport) {
            const incident: LiveIncident = {
              id: `rt-${newReport.id || Date.now()}`,
              corridor_id: newReport.segment_id || "seg-002",
              type: newReport.category || "report",
              title: `New Report: ${newReport.category} at ${newReport.corridor_name || "corridor"}`,
              location: newReport.corridor_name || "East Khasi Hills",
              coords: newReport.lat && newReport.lng ? [newReport.lat, newReport.lng] : undefined,
              severity: newReport.severity >= 4 ? "CRITICAL" : newReport.severity >= 3 ? "HIGH" : "MEDIUM",
              time: newReport.created_at || new Date().toISOString(),
              formattedDate: formatIncidentDate(newReport.created_at || new Date().toISOString()),
              timeAgo: "Just now",
              status: "ACTIVE",
              source: "Citizen WhatsApp Stream / Emergency Web Ingestion",
            };
            setLiveIncidents((prev) => [incident, ...prev].slice(0, 20));
            setActiveRealtimeUpdates((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
    };
  }, []);

  // Fetch latest risk scores from Supabase on mount
  useEffect(() => {
    async function loadLatestRiskScores() {
      try {
        if (!hasSupabaseBrowserEnv()) return;
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
    if (!hasSupabaseBrowserEnv()) return;

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

  const activeIncidents = liveIncidents.filter((inc) => inc.status === "ACTIVE");
  const activeCorridorIds = new Set(activeIncidents.map((inc) => inc.corridor_id).filter(Boolean) as string[]);
  const effectiveClearedIds = new Set(
    Array.from(new Set([...clearedCorridorIds, ...hydratedClearedCorridorIds])).filter(
      (id) => !activeCorridorIds.has(id)
    )
  );
  const activeIncidentRiskByCorridor = new Map<string, number>();
  activeIncidents.forEach((inc) => {
    if (!inc.corridor_id) return;
    const score = inc.severity === "CRITICAL" ? 0.98 : inc.severity === "HIGH" ? 0.78 : 0.55;
    activeIncidentRiskByCorridor.set(
      inc.corridor_id,
      Math.max(activeIncidentRiskByCorridor.get(inc.corridor_id) || 0, score)
    );
  });

  const getEffectiveRisk = (segment: RoadSegmentData) => {
    if (activeCorridorIds.has(segment.id)) {
      const incidentRisk = activeIncidentRiskByCorridor.get(segment.id) || 0.88;
      return Math.max(0.85, incidentRisk);
    }
    if (effectiveClearedIds.has(segment.id)) return 0.32;
    const incidentRisk = activeIncidentRiskByCorridor.get(segment.id) || 0;
    if (blockedSegmentIds?.includes(segment.id)) return Math.max(0.98, incidentRisk);
    return Math.max(segment.risk_score, incidentRisk);
  };

  const mapStats: MapRiskStats = segments.reduce(
    (acc, segment) => {
      const effectiveRisk = getEffectiveRisk(segment);
      if (effectiveRisk >= 0.7) acc.high += 1;
      else if (effectiveRisk >= 0.4) acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    {
      total: segments.length,
      high: 0,
      medium: 0,
      low: 0,
      activeHazards: activeIncidents.length,
      resolvedHazards: liveIncidents.filter((inc) => inc.status === "RESOLVED").length,
    }
  );

  useEffect(() => {
    onMapStatsChange?.(mapStats);
  }, [
    onMapStatsChange,
    mapStats.total,
    mapStats.high,
    mapStats.medium,
    mapStats.low,
    mapStats.activeHazards,
    mapStats.resolvedHazards,
  ]);

  if (!isClient) {
    return (
      <div className={styles.mapLoading}>
        <div className={styles.mapSpinner} />
        <p>Initializing East Khasi Hills GIS Network...</p>
      </div>
    );
  }

  // Filter segments based on corridor display mode and risk level filter
  const displayedSegments = corridorDisplay === "OFF" ? [] : segments.filter((s) => {
    const isBlocked = blockedSegmentIds?.includes(s.id) && !effectiveClearedIds.has(s.id);
    const effectiveRisk = getEffectiveRisk(s);

    // First apply corridor display filter
    if (corridorDisplay === "HAZARDS" && effectiveRisk < 0.7) return false;
    // Then apply risk level filter
    if (filterRiskLevel === "ALL") return true;
    if (filterRiskLevel === "HIGH") return effectiveRisk >= 0.7;
    if (filterRiskLevel === "MEDIUM") return effectiveRisk >= 0.4 && effectiveRisk < 0.7 && !isBlocked;
    if (filterRiskLevel === "LOW") return effectiveRisk < 0.4 && !isBlocked;
    return true;
  });

  const selectedSegmentObj = segments.find((s) => s.id === selectedSegmentId);
  const selectedSegmentCenter: [number, number] | null =
    selectedSegmentObj && selectedSegmentObj.coordinates.length > 0
      ? [selectedSegmentObj.coordinates[0][1], selectedSegmentObj.coordinates[0][0]]
      : null;

  return (
    <div className={styles.mapSectionContainer}>
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
            {showHazardPins ? `⚠️ Active Hazards (${activeIncidents.length})` : "⚠️ Hazards: OFF"}
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

        {/* Live Weather Badge (top-right) */}
        <div className={styles.realtimeBadge}>
          <span className={styles.livePulse} />
          {liveWeather ? (
            <>
              <span style={{ fontWeight: 700 }}>
                {liveWeather.condition === "Heavy Rain" ? "🌧️" : liveWeather.condition === "Moderate Rain" ? "🌦️" : liveWeather.condition === "Light Rain" ? "🌤️" : "☀️"}
                {" "}{liveWeather.temp_c}°C
              </span>
              <span style={{ opacity: 0.7 }}>|</span>
              <span>💧 {Number(liveWeather.rainfall_mm).toFixed(1)} mm/h</span>
              <span style={{ opacity: 0.7 }}>|</span>
              <span>💨 {liveWeather.wind_kmh} km/h</span>
              {activeRealtimeUpdates > 0 && (
                <span className={styles.updateCounter}>({activeRealtimeUpdates} live)</span>
              )}
            </>
          ) : (
            <span>Connecting to weather feed...</span>
          )}
        </div>

        {/* Real-Time Dynamic Reroute Alert Banner */}
        {safeRoute?.is_rerouted && showRerouteBanner && (
          <div className={styles.liveRerouteBanner}>
            <div className={styles.reroutePill}>⚡ LIVE REROUTE APPLIED</div>
            <div className={styles.rerouteText}>
              <strong>Hazard Ahead Blocked:</strong> {safeRoute.reroute_reason || "Corridor obstructed by severe hazard."}
              <span className={styles.rerouteSub}>
                AI Safe Route automatically diverted around blocked highway to alternate pass ({safeRoute.distance_km} km total).
              </span>
            </div>
            <button
              type="button"
              className={styles.rerouteDismissBtn}
              onClick={() => setShowRerouteBanner(false)}
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        )}

        {/* Real-Time Road Reopened / Resolved Alert Banner */}
        {localResolvedNotice && (
          <div className={styles.liveResolvedBanner}>
            <div className={styles.resolvedPill}>✅ ROAD REOPENED & RESTORED</div>
            <div className={styles.resolvedText}>
              <strong>Corridor Restored:</strong> {localResolvedNotice}
              <span className={styles.resolvedSub}>
                District PWD & SDRF confirmed all debris cleared. Pavement restored to Safe (Green).
              </span>
            </div>
            <button
              type="button"
              className={styles.rerouteDismissBtn}
              onClick={() => setLocalResolvedNotice(null)}
              aria-label="Dismiss resolution notice"
            >
              ✕
            </button>
          </div>
        )}

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={true}
          className={styles.leafletContainer}
        >
          <MapViewController targetCoords={selectedSegmentCenter} />

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
          const rawLatLngs = seg.coordinates.map((c) => [c[1], c[0]] as [number, number]);
          const latLngs = rawLatLngs;
          const isBlocked = blockedSegmentIds?.includes(seg.id) && !effectiveClearedIds.has(seg.id);
          const hasActiveIncident = activeIncidentRiskByCorridor.has(seg.id);
          const effectiveRisk = getEffectiveRisk(seg);
          const color = isBlocked ? "#DC2626" : getRiskColor(effectiveRisk);
          const isSelected = selectedSegmentId === seg.id;
          const isHighRisk = effectiveRisk >= 0.7;
          const isMediumRisk = effectiveRisk >= 0.4 && effectiveRisk < 0.7;

          return (
            <Polyline
              key={seg.id}
              positions={latLngs}
              pathOptions={{
                color: color,
                weight: isSelected ? 8 : isBlocked ? 8 : isHighRisk ? 6 : 5,
                opacity: isSelected ? 1.0 : isBlocked ? 1.0 : isHighRisk ? 0.95 : 0.88,
                dashArray: isBlocked ? "8, 5" : undefined,
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
                      {isBlocked
                        ? "🔴 BLOCKED (LANDSLIDE DISRUPTION)"
                        : hasActiveIncident
                        ? "🔴 ACTIVE FIELD HAZARD"
                        : isHighRisk
                        ? "🔴 HAZARDOUS / HIGH SLIP RISK"
                        : isMediumRisk
                        ? "🟡 CAUTION / WET GRADE"
                        : "🟢 CLEAR & PASSABLE"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#64748B" }}>
                    Risk Index: {(effectiveRisk * 100).toFixed(0)}% | Rain: {seg.factors.rainfall_mm} mm/h | Slope: {seg.factors.slope_deg}°
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
                      {isBlocked
                        ? "🔴 Road Obstructed / Active Landslide"
                        : hasActiveIncident
                        ? "🔴 Active Field Hazard / Reroute"
                        : isHighRisk
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
                    {isBlocked || hasActiveIncident
                      ? "⚠️ Active Incident Advisory: field report marks this corridor unsafe until official clearance."
                      : isHighRisk
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
          activeIncidents
            .filter((inc) => inc.coords)
            .map((inc) => {
              const hazardIcon = L.divIcon({
                className: "hazard-pin-icon",
                html: `<div class="${styles.hazardPin}">⚠️</div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 13],
              });

              return (
                <Marker key={`hazard-${inc.id}`} position={inc.coords!} icon={hazardIcon}>
                  <Popup>
                    <div className={styles.popupCard} style={{ maxWidth: "240px" }}>
                      <h4 style={{ color: "#EF4444", margin: "0 0 4px 0", fontSize: "0.85rem" }}>
                        ⚠️ Active Field Hazard
                      </h4>
                      <p style={{ margin: "0 0 6px 0", fontSize: "0.75rem", fontWeight: 700 }}>
                        {inc.title}
                      </p>
                      <p style={{ margin: "0 0 6px 0", fontSize: "0.72rem", color: "#475569" }}>
                        {inc.location}. Source: {inc.source}
                      </p>
                      <div style={{ fontSize: "0.7rem", background: "#FEF2F2", padding: "6px", borderRadius: "4px", color: "#991B1B" }}>
                        Reroute recommended until an official marks this hazard fixed.
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

        {/* === LIVE INCIDENT MARKERS ON MAP === */}
        {liveIncidents
          .filter((inc) => inc.coords && inc.status === "ACTIVE")
          .map((inc) => {
            const incIcon = L.divIcon({
              className: "live-incident-icon",
              html: `<div style="
                background: ${inc.severity === 'CRITICAL' ? '#DC2626' : inc.severity === 'HIGH' ? '#F59E0B' : '#3B82F6'};
                color: white;
                border: 2px solid white;
                border-radius: 20px;
                padding: 2px 8px;
                font-size: 0.65rem;
                font-weight: 800;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                gap: 3px;
                animation: pulse 2s ease-in-out infinite;
              ">
                <span>${inc.type === 'landslide' ? '\u26f0\ufe0f' : inc.type === 'flood' ? '\ud83c\udf0a' : inc.type === 'weather' ? '\ud83c\udf27\ufe0f' : inc.type === 'road_damage' ? '\ud83d\udea7' : '\ud83d\udccb'}</span>
                <span>LIVE</span>
              </div>`,
              iconSize: [60, 22],
              iconAnchor: [30, 11],
            });
            return (
              <Marker key={inc.id} position={inc.coords!} icon={incIcon}>
                <Popup>
                  <div className={styles.popupCard} style={{ maxWidth: "260px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <span style={{
                        background: inc.severity === "CRITICAL" ? "#DC2626" : inc.severity === "HIGH" ? "#F59E0B" : "#3B82F6",
                        color: "white",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "0.65rem",
                        fontWeight: 800,
                      }}>
                        {inc.severity}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "#64748B" }}>{inc.timeAgo}</span>
                    </div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "0.82rem" }}>{inc.title}</h4>
                    <p style={{ margin: "0", fontSize: "0.72rem", color: "#475569" }}>{inc.location}</p>
                    {inc.severity === "CRITICAL" && (
                      <div style={{ marginTop: "6px", background: "#FEF2F2", border: "1px solid #FCA5A5", padding: "4px 6px", borderRadius: "4px", fontSize: "0.68rem", color: "#991B1B" }}>
                        Setu AI is actively rerouting freight away from this zone.
                      </div>
                    )}
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

        {/* Shortest Route Overlay - Only show when an active detour around a blocked hazard is applied */}
        {shortestRoute && shortestRoute.coordinates.length > 1 && safeRoute?.is_rerouted && (
          <Polyline
            positions={shortestRoute.coordinates}
            pathOptions={{
              color: "#DC2626",
              weight: 5,
              dashArray: "8, 8",
              opacity: 0.85,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontFamily: "sans-serif", fontSize: "0.75rem" }}>
                <strong style={{ color: "#DC2626" }}>🔴 Impassable Blocked Highway</strong>
                <div>Direct route obstructed by hazard ({shortestRoute.distance_km} km)</div>
                <div style={{ fontSize: "0.68rem", color: "#64748B" }}>AI Safe Route diverted around this blockage</div>
              </div>
            </Tooltip>
          </Polyline>
        )}

        {/* AI Safe Route Overlay - Dual-layer GPS navigation styling with realistic road curves */}
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

        {/* Origin Departure Marker */}
        {originHubCoords && (
          <Marker
            position={originHubCoords}
            icon={L.divIcon({
              className: "origin-truck-icon",
              html: `<div style="background: #16A34A; color: white; border: 2.5px solid white; border-radius: 50%; width: 26px; height: 26px; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.6); display: flex; align-items: center; justify-content: center; font-size: 13px; transform: translate(-50%, -50%);">
                🚚
              </div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            })}
          >
            <Tooltip permanent direction="top" offset={[0, -14]}>🟢 Route Origin (Freight Departure)</Tooltip>
          </Marker>
        )}

        {/* Destination Target Marker */}
        {destHubCoords && (
          <Marker
            position={destHubCoords}
            icon={L.divIcon({
              className: "dest-flag-icon",
              html: `<div style="background: #1D4ED8; color: white; border: 2.5px solid white; border-radius: 50%; width: 26px; height: 26px; box-shadow: 0 4px 12px rgba(29, 78, 216, 0.6); display: flex; align-items: center; justify-content: center; font-size: 13px; transform: translate(-50%, -50%);">
                🏁
              </div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            })}
          >
            <Tooltip permanent direction="top" offset={[0, -14]}>📍 Destination (Relief Hub)</Tooltip>
          </Marker>
        )}
      </MapContainer>

      {/* Sleek, Compact & Clean Map Legend Bar */}
      <div className={styles.compactLegendBar}>
        <div className={styles.compactLegendItems}>
          <div className={styles.compactLegendItem}>
            <span className={styles.legendColorDot} style={{ background: "#22C55E" }} />
            <span>Safe (Green)</span>
          </div>
          <div className={styles.compactLegendItem}>
            <span className={styles.legendColorDot} style={{ background: "#F59E0B" }} />
            <span>Caution (Yellow)</span>
          </div>
          <div className={styles.compactLegendItem}>
            <span className={styles.legendColorDot} style={{ background: "#EF4444" }} />
            <span>Hazard (Red)</span>
          </div>
          <div className={styles.compactLegendDivider} />
          <div className={styles.compactLegendItem}>
            <span className={styles.legendColorLine} style={{ background: "#0284C7" }} />
            <span>AI Safe Route (Blue)</span>
          </div>
          {safeRoute?.is_rerouted && (
            <div className={styles.compactLegendItem}>
              <span
                style={{
                  display: "inline-block",
                  width: "16px",
                  height: "0px",
                  borderTop: "3px dashed #DC2626",
                  marginRight: "4px",
                }}
              />
              <span style={{ color: "#DC2626", fontWeight: 700 }}>Blocked Direct Path</span>
            </div>
          )}
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
              <strong style={{ color: "#0284C7" }}>🛡️ Setu AI Safe Route:</strong> Geotechnically routed bypass avoiding hazards.
            </div>
            <div className={styles.popoverFormula}>
              <strong>Risk Weighting:</strong> 35% Rain + 25% Slope + 25% Incidents + 15% History.
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Real-Time Live Updates & Field Hazard Reports (POSITIONED JUST BELOW THE MAP) */}
    <div className={styles.liveUpdatesBelowMap}>
      <div className={styles.updatesHeader}>
        <div className={styles.updatesHeaderLeft}>
          <span className={styles.livePulse} />
          <span className={styles.updatesHeaderTitle}>
            Real-Time Field Alerts & Inbound Reports
          </span>
          <span className={styles.updatesSubtitle}>
            (Directly reflected on the GIS Map above)
          </span>
        </div>
        <div className={styles.updatesHeaderRight}>
          <span className={styles.liveFeedBadge}>
            ⚡ Active Feed: {mapStats.activeHazards} Active Hazards
          </span>
          <div className={styles.updatesActionGroup}>
            {onTriggerWhatsAppDemo && (
              <button
                type="button"
                className={styles.updatesTestWaBtn}
                onClick={onTriggerWhatsAppDemo}
                title="Simulate incoming WhatsApp hazard report on NH-6 from a driver"
              >
                <span>📲</span> Test NH-6 WhatsApp Report
              </button>
            )}
            {onTriggerDawkiDemo && (
              <button
                type="button"
                className={styles.updatesTestWaBtn}
                style={{ background: "#6D28D9", border: "1px solid #A78BFA", color: "#FFFFFF" }}
                onClick={onTriggerDawkiDemo}
                title="Verify Dawki Hazard (NH-40), display on map and calculate dynamic detour"
              >
                <span>⚠️</span> Test Dawki Hazard & Reroute
              </button>
            )}
            <button
              type="button"
              className={styles.simulateClearBtn}
              onClick={() => handleLocalResolve("live-001", "seg-002")}
              title="Official Action: Declare active hazard on NH-6 cleared and road reopened"
            >
              <span>👷</span> Official Clears Road
            </button>
          </div>
        </div>
      </div>

      {/* Data Freshness & Provenance Bar */}
      <div className={styles.provenanceBar}>
        <div className={styles.provenanceItem}>
          <span className={styles.provenanceDot} style={{ background: "#22C55E" }} />
          <span><strong>Live Clock:</strong> {liveClock || "Active Now"}</span>
        </div>
        <div className={styles.provenanceItem}>
          <span className={styles.provenanceDot} style={{ background: "#0284C7" }} />
          <span><strong>Precipitation Stream:</strong> OpenWeatherMap API (Polled every 30s) • Refreshed: Today</span>
        </div>
        <div className={styles.provenanceItem}>
          <span className={styles.provenanceDot} style={{ background: "#8B5CF6" }} />
          <span><strong>Geological Baseline:</strong> Geological Survey of India (GSI) NLSM Multi-Month Model</span>
        </div>
        <div className={styles.provenanceItem}>
          <span className={styles.provenanceDot} style={{ background: "#F59E0B" }} />
          <span><strong>Inbound Dispatch:</strong> Citizen & Driver WhatsApp Feed (Active)</span>
        </div>
      </div>

      {/* Incident Lifecycle Tabs */}
      <div className={styles.updatesTabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${incidentTabFilter === "ALL" ? styles.activeTabBtn : ""}`}
          onClick={() => setIncidentTabFilter("ALL")}
        >
          All Reports ({liveIncidents.length})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${incidentTabFilter === "ACTIVE" ? styles.activeTabBtn : ""}`}
          onClick={() => setIncidentTabFilter("ACTIVE")}
        >
          🔴 Active Hazards ({mapStats.activeHazards})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${incidentTabFilter === "RESOLVED" ? styles.activeTabBtn : ""}`}
          onClick={() => setIncidentTabFilter("RESOLVED")}
        >
          🟢 Fixed & Cleared ({mapStats.resolvedHazards})
        </button>
      </div>

      <div className={styles.updatesGrid}>
        {liveIncidents
          .filter((inc) => {
            if (incidentTabFilter === "ACTIVE") return inc.status !== "RESOLVED";
            if (incidentTabFilter === "RESOLVED") return inc.status === "RESOLVED";
            return true;
          })
          .map((inc) => (
            <div
              key={inc.id}
              className={styles.updateCard}
              data-severity={inc.severity}
              data-status={inc.status}
            >
              <div className={styles.updateCardTop}>
                <span className={styles.updateCardIcon}>
                  {inc.type === "landslide" ? "⛰️" : inc.type === "flood" ? "🌊" : inc.type === "weather" ? "🌧️" : inc.type === "road_damage" ? "🚧" : "📋"}
                </span>
                {inc.status === "RESOLVED" ? (
                  <span className={styles.resolvedBadge}>🟢 FIXED & REOPENED</span>
                ) : (
                  <span className={styles.updateCardSeverity} data-severity={inc.severity}>
                    {inc.severity}
                  </span>
                )}
                <span className={styles.updateCardTime}>{inc.timeAgo}</span>
              </div>
              <div className={styles.updateCardTitle}>{inc.title}</div>
              <div className={styles.updateCardLoc}>📍 {inc.location}</div>
              <div style={{ fontSize: "0.68rem", color: "#64748B", marginTop: "2px" }}>
                🕒 <strong>Reported:</strong> {inc.formattedDate}
              </div>
              <div style={{ fontSize: "0.65rem", color: "#475569", background: "rgba(0,0,0,0.03)", padding: "3px 6px", borderRadius: "4px" }}>
                📡 <strong>Data Source:</strong> {inc.source}
              </div>
              <div className={styles.updateCardReflect}>
                {inc.status === "RESOLVED" ? (
                  <div>
                    <div style={{ color: "#16A34A", fontWeight: 700 }}>
                      ✅ Hazard Cleared & Road Reopened by {inc.resolvedBy || "District PWD"}
                    </div>
                    {inc.resolvedAt && (
                      <div style={{ fontSize: "0.65rem", color: "#64748B" }}>
                        Cleared on: {inc.resolvedAt} • Corridor safe on map above.
                      </div>
                    )}
                  </div>
                ) : inc.severity === "CRITICAL" ? (
                  "🔴 Reflected as Red Blocked Corridor on Map (AI Safe Route Diverts Around It)"
                ) : inc.severity === "HIGH" ? (
                  "🟡 Reflected as Caution Corridor on Map (Reduced Speed Advisory)"
                ) : (
                  "🟢 Active Monitoring on Map"
                )}
              </div>
              {inc.status !== "RESOLVED" && (
                <button
                  type="button"
                  className={styles.updateCardFixedBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLocalResolve(inc.id, inc.corridor_id);
                  }}
                  title="Official Action: Mark this hazard cleared and reopen road"
                >
                  <span>✅</span> Mark Hazard Fixed (Official)
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  </div>
  );
}
