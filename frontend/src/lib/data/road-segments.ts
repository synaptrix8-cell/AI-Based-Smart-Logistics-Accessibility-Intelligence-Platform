/**
 * Road Network Data & Client-Side Safe Routing Algorithm
 * Setu — Smart Logistics & Accessibility Intelligence Platform
 *
 * Provides seed road segments for East Khasi Hills (NH6/NH40/SH5)
 * and an offline-resilient Dijkstra safe pathfinder.
 */

export interface RoadSegmentData {
  id: string;
  name: string;
  highway_ref: string;
  length_km: number;
  base_risk: number;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  coordinates: [number, number][]; // [lng, lat]
  factors: {
    rainfall_mm: number;
    slope_deg: number;
    active_reports: number;
  };
}

export const EAST_KHASI_HILLS_SEGMENTS: RoadSegmentData[] = [
  {
    id: "seg-001",
    name: "Nongpoh – Umiam Approach",
    highway_ref: "NH6",
    length_km: 6.2,
    base_risk: 0.35,
    risk_score: 0.32,
    risk_level: "LOW",
    coordinates: [[91.765, 25.891], [91.780, 25.870], [91.795, 25.848]],
    factors: { rainfall_mm: 8.5, slope_deg: 8.0, active_reports: 0 },
  },
  {
    id: "seg-002",
    name: "Umiam Lake Bypass",
    highway_ref: "NH6",
    length_km: 7.8,
    base_risk: 0.25,
    risk_score: 0.24,
    risk_level: "LOW",
    coordinates: [[91.795, 25.848], [91.830, 25.830], [91.860, 25.815]],
    factors: { rainfall_mm: 10.2, slope_deg: 5.0, active_reports: 0 },
  },
  {
    id: "seg-003",
    name: "Umiam – Upper Shillong Descent",
    highway_ref: "NH6",
    length_km: 4.5,
    base_risk: 0.65,
    risk_score: 0.74,
    risk_level: "HIGH",
    coordinates: [[91.860, 25.815], [91.875, 25.795], [91.882, 25.780]],
    factors: { rainfall_mm: 19.4, slope_deg: 28.5, active_reports: 1 },
  },
  {
    id: "seg-004",
    name: "Upper Shillong – Laitumkhrah",
    highway_ref: "NH6",
    length_km: 5.1,
    base_risk: 0.30,
    risk_score: 0.28,
    risk_level: "LOW",
    coordinates: [[91.882, 25.780], [91.876, 25.572], [91.884, 25.565]],
    factors: { rainfall_mm: 12.0, slope_deg: 12.0, active_reports: 0 },
  },
  {
    id: "seg-005",
    name: "Shillong Police Bazaar Bypass",
    highway_ref: "NH6",
    length_km: 3.0,
    base_risk: 0.20,
    risk_score: 0.18,
    risk_level: "LOW",
    coordinates: [[91.884, 25.565], [91.893, 25.555], [91.900, 25.548]],
    factors: { rainfall_mm: 11.5, slope_deg: 6.0, active_reports: 0 },
  },
  {
    id: "seg-006",
    name: "Shillong – Laitlyngkot",
    highway_ref: "NH40",
    length_km: 8.3,
    base_risk: 0.45,
    risk_score: 0.48,
    risk_level: "MEDIUM",
    coordinates: [[91.900, 25.548], [91.920, 25.530], [91.945, 25.510]],
    factors: { rainfall_mm: 16.0, slope_deg: 18.0, active_reports: 0 },
  },
  {
    id: "seg-007",
    name: "Laitlyngkot – Pynursla",
    highway_ref: "NH40",
    length_km: 10.2,
    base_risk: 0.55,
    risk_score: 0.62,
    risk_level: "MEDIUM",
    coordinates: [[91.945, 25.510], [91.980, 25.480], [92.010, 25.450]],
    factors: { rainfall_mm: 26.5, slope_deg: 24.0, active_reports: 0 },
  },
  {
    id: "seg-008",
    name: "Pynursla – Mawsynram Approach",
    highway_ref: "NH40",
    length_km: 9.1,
    base_risk: 0.75,
    risk_score: 0.86,
    risk_level: "CRITICAL",
    coordinates: [[92.010, 25.450], [92.040, 25.430], [92.060, 25.410]],
    factors: { rainfall_mm: 48.0, slope_deg: 32.0, active_reports: 2 },
  },
  {
    id: "seg-009",
    name: "Mawsynram – Cherrapunji Road",
    highway_ref: "NH40",
    length_km: 7.6,
    base_risk: 0.85,
    risk_score: 0.91,
    risk_level: "CRITICAL",
    coordinates: [[91.720, 25.300], [91.735, 25.290], [91.750, 25.280]],
    factors: { rainfall_mm: 52.3, slope_deg: 36.5, active_reports: 3 },
  },
  {
    id: "seg-010",
    name: "Cherrapunji – Nongriat Descent",
    highway_ref: "NH40",
    length_km: 5.4,
    base_risk: 0.80,
    risk_score: 0.82,
    risk_level: "HIGH",
    coordinates: [[91.750, 25.280], [91.765, 25.265], [91.780, 25.250]],
    factors: { rainfall_mm: 44.0, slope_deg: 34.0, active_reports: 1 },
  },
  {
    id: "seg-011",
    name: "Mawlai – Nongthymmai Link",
    highway_ref: "Local",
    length_km: 3.8,
    base_risk: 0.40,
    risk_score: 0.38,
    risk_level: "LOW",
    coordinates: [[91.850, 25.590], [91.865, 25.580], [91.875, 25.572]],
    factors: { rainfall_mm: 12.5, slope_deg: 10.0, active_reports: 0 },
  },
  {
    id: "seg-012",
    name: "Laban – Mawprem Road",
    highway_ref: "Local",
    length_km: 3.2,
    base_risk: 0.35,
    risk_score: 0.34,
    risk_level: "LOW",
    coordinates: [[91.880, 25.560], [91.870, 25.575], [91.860, 25.585]],
    factors: { rainfall_mm: 11.8, slope_deg: 14.0, active_reports: 0 },
  },
  {
    id: "seg-013",
    name: "Shillong – Jowai Road Start",
    highway_ref: "NH44",
    length_km: 6.9,
    base_risk: 0.40,
    risk_score: 0.42,
    risk_level: "MEDIUM",
    coordinates: [[91.900, 25.548], [91.930, 25.550], [91.960, 25.555]],
    factors: { rainfall_mm: 15.0, slope_deg: 12.0, active_reports: 0 },
  },
  {
    id: "seg-014",
    name: "Smit – Nongkrem Sacred Grove Road",
    highway_ref: "Local",
    length_km: 4.5,
    base_risk: 0.50,
    risk_score: 0.52,
    risk_level: "MEDIUM",
    coordinates: [[91.840, 25.600], [91.830, 25.615], [91.820, 25.630]],
    factors: { rainfall_mm: 14.2, slope_deg: 16.0, active_reports: 0 },
  },
  {
    id: "seg-015",
    name: "Cherrapunji Town Bypass",
    highway_ref: "NH40",
    length_km: 3.1,
    base_risk: 0.40,
    risk_score: 0.39,
    risk_level: "LOW",
    coordinates: [[91.750, 25.280], [91.745, 25.275], [91.730, 25.270]],
    factors: { rainfall_mm: 38.0, slope_deg: 8.0, active_reports: 0 },
  },
  {
    id: "seg-016",
    name: "Shillong – Mawphlang – Sohra Highway",
    highway_ref: "SH5",
    length_km: 28.5,
    base_risk: 0.35,
    risk_score: 0.36,
    risk_level: "LOW",
    coordinates: [[91.876, 25.572], [91.830, 25.460], [91.760, 25.360], [91.720, 25.300]],
    factors: { rainfall_mm: 22.0, slope_deg: 14.0, active_reports: 0 },
  },
  {
    id: "seg-017",
    name: "Laitlyngkot – Cherrapunji Scenic Link",
    highway_ref: "MDR",
    length_km: 31.2,
    base_risk: 0.50,
    risk_score: 0.54,
    risk_level: "MEDIUM",
    coordinates: [[91.945, 25.510], [91.880, 25.400], [91.810, 25.320], [91.750, 25.280]],
    factors: { rainfall_mm: 31.0, slope_deg: 22.0, active_reports: 0 },
  },
];

// District boundary polygon for East Khasi Hills (GeoJSON-like coordinates: [lat, lng])
export const EAST_KHASI_HILLS_BOUNDARY: [number, number][] = [
  [25.895, 91.68],
  [25.910, 91.95],
  [25.820, 92.12],
  [25.550, 92.15],
  [25.210, 92.05],
  [25.180, 91.62],
  [25.420, 91.55],
  [25.750, 91.62],
  [25.895, 91.68],
];

export interface KeyHub {
  id: string;
  name: string;
  coords: [number, number]; // [lat, lng]
  elevation_m: number;
}

export const KEY_HUBS: KeyHub[] = [
  { id: "nongpoh", name: "Nongpoh (NH6 Gateway)", coords: [25.891, 91.765], elevation_m: 485 },
  { id: "umiam", name: "Umiam Lake Hub", coords: [25.848, 91.795], elevation_m: 980 },
  { id: "shillong_center", name: "Shillong Police Bazaar", coords: [25.548, 91.900], elevation_m: 1496 },
  { id: "shillong_upper", name: "Upper Shillong (Air Force)", coords: [25.572, 91.876], elevation_m: 1720 },
  { id: "mawphlang", name: "Mawphlang Sacred Grove", coords: [25.460, 91.830], elevation_m: 1810 },
  { id: "laitlyngkot", name: "Laitlyngkot Junction", coords: [25.510, 91.945], elevation_m: 1780 },
  { id: "pynursla", name: "Pynursla Ridge", coords: [25.450, 92.010], elevation_m: 1420 },
  { id: "cherrapunji", name: "Cherrapunji (Sohra)", coords: [25.280, 91.750], elevation_m: 1430 },
  { id: "mawsynram", name: "Mawsynram Station", coords: [25.300, 91.720], elevation_m: 1400 },
  { id: "nongriat", name: "Nongriat Living Root Bridge", coords: [25.250, 91.780], elevation_m: 680 },
];

export function getRiskColor(score: number): string {
  if (score < 0.4) return "#22C55E"; // Green
  if (score < 0.7) return "#F59E0B"; // Amber
  if (score < 0.85) return "#EF4444"; // Red
  return "#991B1B"; // Critical Dark Red
}

function haversine(p1: [number, number], p2: [number, number]): number {
  const [lat1, lng1] = p1;
  const [lat2, lng2] = p2;
  const R = 6371.0;
  const dlat = ((lat2 - lat1) * Math.PI) / 180;
  const dlng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dlng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));
}

/**
 * Client-Side Dijkstra Router — Computes shortest vs risk-penalized safe route
 */
export function computeClientSafeRoute(
  originCoords: [number, number], // [lat, lng]
  destCoords: [number, number],   // [lat, lng]
  avoidRiskAbove: number = 0.75
) {
  // Extract all points and create an adjacency graph
  type NodeKey = string;
  const nodeKey = (p: [number, number]): NodeKey => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const keyToPoint = (k: NodeKey): [number, number] => {
    const [lat, lng] = k.split(",").map(Number);
    return [lat, lng];
  };

  interface Edge {
    to: NodeKey;
    distance: number;
    risk: number;
    name: string;
  }

  const adj: Map<NodeKey, Edge[]> = new Map();

  const addEdge = (u: [number, number], v: [number, number], dist: number, risk: number, name: string) => {
    const ku = nodeKey(u);
    const kv = nodeKey(v);
    if (!adj.has(ku)) adj.set(ku, []);
    if (!adj.has(kv)) adj.set(kv, []);
    adj.get(ku)!.push({ to: kv, distance: dist, risk, name });
    adj.get(kv)!.push({ to: ku, distance: dist, risk, name });
  };

  // Add road segments to graph
  for (const seg of EAST_KHASI_HILLS_SEGMENTS) {
    const coords = seg.coordinates.map((c) => [c[1], c[0]] as [number, number]); // [lat, lng]
    const subDist = seg.length_km / Math.max(1, coords.length - 1);
    for (let i = 0; i < coords.length - 1; i++) {
      addEdge(coords[i], coords[i + 1], subDist, seg.risk_score, seg.name);
    }
  }

  // Add proximity connector edges between close junctions (<= 3.5 km)
  const allNodes = Array.from(adj.keys()).map(keyToPoint);
  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const d = haversine(allNodes[i], allNodes[j]);
      if (d > 0.01 && d <= 3.5) {
        addEdge(allNodes[i], allNodes[j], d, 0.3, "Connector Link");
      }
    }
  }

  // Find nearest start and end nodes
  const findNearest = (target: [number, number]): NodeKey => {
    let bestKey = nodeKey(allNodes[0]);
    let minD = Infinity;
    for (const n of allNodes) {
      const d = haversine(target, n);
      if (d < minD) {
        minD = d;
        bestKey = nodeKey(n);
      }
    }
    return bestKey;
  };

  const startKey = findNearest(originCoords);
  const targetKey = findNearest(destCoords);

  const runDijkstra = (useRiskPenalty: boolean) => {
    const distMap: Map<NodeKey, number> = new Map();
    const prevMap: Map<NodeKey, { node: NodeKey; edge: Edge } | null> = new Map();
    const visited: Set<NodeKey> = new Set();

    for (const k of adj.keys()) {
      distMap.set(k, Infinity);
    }
    distMap.set(startKey, 0);

    while (visited.size < distMap.size) {
      let u: NodeKey | null = null;
      let minD = Infinity;
      for (const [k, d] of distMap.entries()) {
        if (!visited.has(k) && d < minD) {
          minD = d;
          u = k;
        }
      }

      if (!u || minD === Infinity || u === targetKey) break;
      visited.add(u);

      const neighbors = adj.get(u) || [];
      for (const edge of neighbors) {
        if (visited.has(edge.to)) continue;

        let weight = edge.distance;
        if (useRiskPenalty) {
          let multiplier = 1.0 + 8.0 * (edge.risk ** 2);
          if (edge.risk >= avoidRiskAbove) {
            multiplier *= 25.0; // extreme avoidance penalty
          }
          weight *= multiplier;
        }

        const alt = distMap.get(u)! + weight;
        if (alt < distMap.get(edge.to)!) {
          distMap.set(edge.to, alt);
          prevMap.set(edge.to, { node: u, edge });
        }
      }
    }

    // Reconstruct path
    const path: [number, number][] = [];
    let curr: NodeKey | null = targetKey;
    let totalKm = 0;
    let riskWeightedSum = 0;
    const corridors = new Set<string>();

    while (curr && prevMap.has(curr)) {
      path.unshift(keyToPoint(curr));
      const step = prevMap.get(curr);
      if (step) {
        totalKm += step.edge.distance;
        riskWeightedSum += step.edge.distance * step.edge.risk;
        if (step.edge.name !== "Connector Link") {
          corridors.add(step.edge.name);
        }
        curr = step.node;
      } else {
        break;
      }
    }

    if (curr) path.unshift(keyToPoint(curr));

    const avgRisk = totalKm > 0 ? Number((riskWeightedSum / totalKm).toFixed(2)) : 0;

    return {
      coordinates: path,
      distance_km: Number(totalKm.toFixed(1)),
      avg_risk: avgRisk,
      corridors: Array.from(corridors),
    };
  };

  const shortest = runDijkstra(false);
  const safe = runDijkstra(true);

  const riskReduction = Math.max(
    0,
    Math.round(((shortest.avg_risk - safe.avg_risk) / Math.max(0.01, shortest.avg_risk)) * 100)
  );

  return {
    shortest_route: shortest,
    safe_route: safe,
    risk_reduction_pct: riskReduction,
  };
}
