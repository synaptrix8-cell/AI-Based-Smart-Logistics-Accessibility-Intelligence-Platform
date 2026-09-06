/**
 * Centralized Hazard & Report Synchronization Engine
 * Setu - Logistics & Accessibility Intelligence Platform
 *
 * Ensures 100% interconnected state between:
 * 1. Incident Verification Queue (/dashboard/reports)
 * 2. GIS Risk Map & Bottom Incident Feed (/dashboard)
 * 3. AI Dynamic Safe Routing Engine (/api/routing/safe-route)
 * 4. Alerts Broadcast Console (/dashboard/alerts)
 */

export interface UnifiedHazardReport {
  id: string;
  category: "landslide" | "flood" | "road_damage" | "congestion" | "other";
  corridor_name: string;
  segment_id: string;
  lat: number;
  lng: number;
  severity: number;
  description: string;
  status: "unverified" | "verified" | "rejected" | "resolved";
  created_at: string;
  verified_at?: string;
  resolved_at?: string;
  resolved_by?: string;
}

const STORAGE_VERIFIED = "setu_verified_reports";
const STORAGE_CLEARED = "setu_cleared_corridors";
const STORAGE_RESOLVED = "setu_resolved_incidents";

/**
 * Get all verified reports from localStorage
 */
export function getStoredVerifiedReports(): Record<string, UnifiedHazardReport> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_VERIFIED);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Get all cleared corridors from localStorage
 */
export function getStoredClearedCorridors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_CLEARED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Get all resolved incidents from localStorage
 */
export function getStoredResolvedIncidents(): Record<string, { resolvedBy: string; resolvedAt: string }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_RESOLVED);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Mark a report as VERIFIED:
 * - Persists to localStorage
 * - Un-clears the corridor so the GIS map reflects the hazard immediately
 * - Emits event to update map & dynamic routing in real time
 */
export function markReportVerified(report: {
  id: string;
  category?: string;
  corridor_name?: string;
  segment_id?: string;
  lat?: number;
  lng?: number;
  severity?: number;
  description?: string;
}): UnifiedHazardReport {
  const verifiedMap = getStoredVerifiedReports();

  // Normalize segment_id
  let segId = report.segment_id || "seg-002";
  if (report.id === "rep-ekh-002" || report.corridor_name?.toLowerCase().includes("dawki")) {
    segId = "seg-013";
  } else if (report.id === "rep-ekh-001" || report.corridor_name?.toLowerCase().includes("cherrapunji")) {
    segId = "seg-010";
  } else if (report.id === "rep-ekh-003" || report.corridor_name?.toLowerCase().includes("mawphlang")) {
    segId = "seg-008";
  }

  const record: UnifiedHazardReport = {
    id: report.id,
    category: (report.category as any) || "landslide",
    corridor_name: report.corridor_name || "Monitored Corridor",
    segment_id: segId,
    lat: report.lat ?? 25.2104,
    lng: report.lng ?? 91.9541,
    severity: report.severity ?? 3,
    description: report.description || "Field hazard confirmed by triage officer",
    status: "verified",
    created_at: new Date().toISOString(),
    verified_at: new Date().toISOString(),
  };

  verifiedMap[report.id] = record;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_VERIFIED, JSON.stringify(verifiedMap));

      // CRITICAL: A verified hazard is active! Remove from cleared corridors!
      const cleared = getStoredClearedCorridors().filter((id) => id !== segId);
      localStorage.setItem(STORAGE_CLEARED, JSON.stringify(cleared));

      // Remove from resolved map
      const resolved = getStoredResolvedIncidents();
      delete resolved[report.id];
      delete resolved[`inc-${report.id}`];
      localStorage.setItem(STORAGE_RESOLVED, JSON.stringify(resolved));

      // Broadcast real-time event across components
      window.dispatchEvent(
        new CustomEvent("setu_hazard_verified", { detail: record })
      );
    } catch (err) {
      console.warn("Storage sync error:", err);
    }
  }

  // Push to server API in background
  try {
    fetch("/api/reports/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    }).catch(() => {});
  } catch {}

  return record;
}

/**
 * Mark a hazard as FIXED / RESOLVED:
 * - Corridor turns Green (Safe)
 * - Corridor removed from blocked list
 * - Route snaps back to direct highway through where the hazard was
 */
export function markHazardResolved(
  corridorId: string,
  incidentId: string = "live-001",
  resolvedBy: string = "Meghalaya PWD (NH Division) & SDRF Rapid Clearing Unit"
) {
  const resolvedAt = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (typeof window !== "undefined") {
    try {
      // 1. Add to cleared corridors
      const cleared = getStoredClearedCorridors();
      if (!cleared.includes(corridorId)) {
        cleared.push(corridorId);
        localStorage.setItem(STORAGE_CLEARED, JSON.stringify(cleared));
      }

      // 2. Add to resolved incidents
      const resolved = getStoredResolvedIncidents();
      resolved[incidentId] = { resolvedBy, resolvedAt };
      const rawId = incidentId.replace("inc-", "");
      resolved[rawId] = { resolvedBy, resolvedAt };
      localStorage.setItem(STORAGE_RESOLVED, JSON.stringify(resolved));

      // 3. Update report if matching
      const verified = getStoredVerifiedReports();
      if (verified[rawId]) {
        verified[rawId].status = "resolved";
        verified[rawId].resolved_at = resolvedAt;
        verified[rawId].resolved_by = resolvedBy;
        localStorage.setItem(STORAGE_VERIFIED, JSON.stringify(verified));
      }

      // Broadcast real-time event
      window.dispatchEvent(
        new CustomEvent("setu_hazard_resolved", {
          detail: { corridorId, incidentId, resolvedBy, resolvedAt },
        })
      );
    } catch (err) {
      console.warn("Storage resolve sync error:", err);
    }
  }

  // Push to server API in background
  try {
    fetch("/api/alerts/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        corridor_id: corridorId,
        incident_id: incidentId,
        resolved_by: resolvedBy,
      }),
    }).catch(() => {});
  } catch {}
}
