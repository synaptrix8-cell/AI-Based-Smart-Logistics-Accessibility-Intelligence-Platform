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
    name: "Nongpoh – Umsning Highway (NH6 North)",
    highway_ref: "NH6",
    length_km: 17.5,
    base_risk: 0.32,
    risk_score: 0.32,
    risk_level: "LOW",
    coordinates: [
      [91.765, 25.891],
      [91.782, 25.872],
      [91.802, 25.852],
      [91.825, 25.832],
      [91.850, 25.810],
      [91.872, 25.788],
      [91.888, 25.768],
      [91.902, 25.752],
    ],
    factors: { rainfall_mm: 12.0, slope_deg: 9.0, active_reports: 0 },
  },
  {
    id: "seg-002",
    name: "Umsning – Umiam Lake Sector (NH6)",
    highway_ref: "NH6",
    length_km: 11.2,
    base_risk: 0.25,
    risk_score: 0.24,
    risk_level: "LOW",
    coordinates: [
      [91.902, 25.752],
      [91.908, 25.735],
      [91.912, 25.715],
      [91.910, 25.695],
      [91.905, 25.678],
      [91.895, 25.660],
    ],
    factors: { rainfall_mm: 14.5, slope_deg: 7.5, active_reports: 0 },
  },
  {
    id: "seg-003",
    name: "Umiam – Upper Shillong Descent (NH6 Direct)",
    highway_ref: "NH6",
    length_km: 10.5,
    base_risk: 0.65,
    risk_score: 0.76,
    risk_level: "HIGH",
    coordinates: [
      [91.895, 25.660],
      [91.890, 25.642],
      [91.884, 25.626],
      [91.878, 25.612],
      [91.875, 25.598],
      [91.880, 25.585],
      [91.885, 25.572],
    ],
    factors: { rainfall_mm: 36.4, slope_deg: 28.5, active_reports: 1 },
  },
  {
    id: "seg-004",
    name: "Shillong Bypass East Arterial (NH6 Bypass)",
    highway_ref: "NH6 Bypass",
    length_km: 22.4,
    base_risk: 0.22,
    risk_score: 0.24,
    risk_level: "LOW",
    coordinates: [
      [91.902, 25.752],
      [91.928, 25.740],
      [91.955, 25.720],
      [91.982, 25.695],
      [92.008, 25.660],
      [92.025, 25.620],
      [92.035, 25.575],
    ],
    factors: { rainfall_mm: 11.2, slope_deg: 6.0, active_reports: 0 },
  },
  {
    id: "seg-005",
    name: "Mawryngkneng – Shillong Central (NH44 West)",
    highway_ref: "NH44",
    length_km: 15.1,
    base_risk: 0.25,
    risk_score: 0.28,
    risk_level: "LOW",
    coordinates: [
      [92.035, 25.575],
      [92.000, 25.574],
      [91.965, 25.573],
      [91.925, 25.572],
      [91.885, 25.572],
    ],
    factors: { rainfall_mm: 13.0, slope_deg: 7.0, active_reports: 0 },
  },
  {
    id: "seg-006",
    name: "Mawryngkneng – Laitlyngkot Freight Connector",
    highway_ref: "Freight Bypass",
    length_km: 17.8,
    base_risk: 0.30,
    risk_score: 0.32,
    risk_level: "LOW",
    coordinates: [
      [92.035, 25.575],
      [92.015, 25.540],
      [91.985, 25.505],
      [91.950, 25.475],
      [91.920, 25.448],
    ],
    factors: { rainfall_mm: 15.0, slope_deg: 11.0, active_reports: 0 },
  },
  {
    id: "seg-007",
    name: "Shillong Central – Upper Shillong (SH5 Urban)",
    highway_ref: "SH5",
    length_km: 5.2,
    base_risk: 0.28,
    risk_score: 0.30,
    risk_level: "LOW",
    coordinates: [
      [91.885, 25.572],
      [91.872, 25.560],
      [91.860, 25.548],
      [91.848, 25.535],
    ],
    factors: { rainfall_mm: 16.5, slope_deg: 9.0, active_reports: 0 },
  },
  {
    id: "seg-008",
    name: "Upper Shillong – Mawphlang (SH5 Sector 1)",
    highway_ref: "SH5",
    length_km: 11.5,
    base_risk: 0.32,
    risk_score: 0.35,
    risk_level: "LOW",
    coordinates: [
      [91.848, 25.535],
      [91.832, 25.520],
      [91.815, 25.502],
      [91.792, 25.480],
      [91.765, 25.455],
    ],
    factors: { rainfall_mm: 19.0, slope_deg: 13.0, active_reports: 0 },
  },
  {
    id: "seg-009",
    name: "Mawphlang – Mawkdok Dympep Gorge (SH5 Sector 2)",
    highway_ref: "SH5",
    length_km: 13.8,
    base_risk: 0.38,
    risk_score: 0.42,
    risk_level: "MEDIUM",
    coordinates: [
      [91.765, 25.455],
      [91.760, 25.428],
      [91.756, 25.400],
      [91.752, 25.370],
      [91.748, 25.340],
    ],
    factors: { rainfall_mm: 28.0, slope_deg: 20.0, active_reports: 0 },
  },
  {
    id: "seg-010",
    name: "Mawkdok Valley – Cherrapunji Plateau",
    highway_ref: "SH5",
    length_km: 8.4,
    base_risk: 0.42,
    risk_score: 0.45,
    risk_level: "MEDIUM",
    coordinates: [
      [91.748, 25.340],
      [91.742, 25.318],
      [91.736, 25.295],
      [91.728, 25.275],
    ],
    factors: { rainfall_mm: 34.0, slope_deg: 18.0, active_reports: 0 },
  },
  {
    id: "seg-011",
    name: "Upper Shillong – Laitlyngkot (NH40 Ridge)",
    highway_ref: "NH40",
    length_km: 12.6,
    base_risk: 0.40,
    risk_score: 0.44,
    risk_level: "MEDIUM",
    coordinates: [
      [91.848, 25.535],
      [91.868, 25.512],
      [91.892, 25.480],
      [91.920, 25.448],
    ],
    factors: { rainfall_mm: 22.0, slope_deg: 16.0, active_reports: 0 },
  },
  {
    id: "seg-012",
    name: "Laitlyngkot – Pynursla Ridge (NH40)",
    highway_ref: "NH40",
    length_km: 14.1,
    base_risk: 0.50,
    risk_score: 0.55,
    risk_level: "MEDIUM",
    coordinates: [
      [91.920, 25.448],
      [91.925, 25.418],
      [91.922, 25.385],
      [91.918, 25.352],
      [91.912, 25.330],
    ],
    factors: { rainfall_mm: 31.0, slope_deg: 21.0, active_reports: 0 },
  },
  {
    id: "seg-013",
    name: "Pynursla – Dawki Border Highway (NH40)",
    highway_ref: "NH40",
    length_km: 19.8,
    base_risk: 0.52,
    risk_score: 0.58,
    risk_level: "MEDIUM",
    coordinates: [
      [91.912, 25.330],
      [91.935, 25.295],
      [91.962, 25.260],
      [91.992, 25.222],
      [92.025, 25.185],
    ],
    factors: { rainfall_mm: 36.0, slope_deg: 24.0, active_reports: 0 },
  },
  {
    id: "seg-014",
    name: "Laitlyngkot – Mawkdok Valley Link (MDR27)",
    highway_ref: "MDR27",
    length_km: 18.9,
    base_risk: 0.44,
    risk_score: 0.48,
    risk_level: "MEDIUM",
    coordinates: [
      [91.920, 25.448],
      [91.885, 25.422],
      [91.845, 25.395],
      [91.800, 25.365],
      [91.748, 25.340],
    ],
    factors: { rainfall_mm: 29.0, slope_deg: 22.0, active_reports: 0 },
  },
  {
    id: "seg-015",
    name: "Mawphlang – Mawsynram Escarpment (SH4)",
    highway_ref: "SH4",
    length_km: 22.1,
    base_risk: 0.60,
    risk_score: 0.68,
    risk_level: "MEDIUM",
    coordinates: [
      [91.765, 25.455],
      [91.725, 25.428],
      [91.680, 25.395],
      [91.635, 25.345],
      [91.582, 25.295],
    ],
    factors: { rainfall_mm: 42.0, slope_deg: 27.0, active_reports: 1 },
  },
  {
    id: "seg-016",
    name: "Mawsynram – Cherrapunji Gorge Link",
    highway_ref: "NH40 Link",
    length_km: 15.6,
    base_risk: 0.78,
    risk_score: 0.88,
    risk_level: "CRITICAL",
    coordinates: [
      [91.582, 25.295],
      [91.620, 25.288],
      [91.660, 25.282],
      [91.695, 25.278],
      [91.728, 25.275],
    ],
    factors: { rainfall_mm: 56.5, slope_deg: 36.0, active_reports: 3 },
  },
  {
    id: "seg-017",
    name: "Cherrapunji – Nohkalikai & Living Root Trail",
    highway_ref: "Local",
    length_km: 4.8,
    base_risk: 0.72,
    risk_score: 0.82,
    risk_level: "HIGH",
    coordinates: [
      [91.728, 25.275],
      [91.715, 25.262],
      [91.702, 25.250],
    ],
    factors: { rainfall_mm: 49.0, slope_deg: 35.0, active_reports: 2 },
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
  role?: string;
  icon?: string;
  coords: [number, number]; // [lat, lng]
  elevation_m: number;
}

export const KEY_HUBS: KeyHub[] = [
  { id: "nongpoh", name: "Nongpoh (NH6 Gateway)", role: "Northern Gateway", icon: "🚚", coords: [25.891, 91.765], elevation_m: 485 },
  { id: "umiam", name: "Umiam Lake Hub", role: "Bypass Corridor", icon: "💧", coords: [25.660, 91.895], elevation_m: 980 },
  { id: "shillong_center", name: "Shillong Central Hub", role: "Logistics HQ", icon: "🏛️", coords: [25.572, 91.885], elevation_m: 1496 },
  { id: "shillong_upper", name: "Upper Shillong Base", role: "Relief Airbase", icon: "📦", coords: [25.535, 91.848], elevation_m: 1720 },
  { id: "mawphlang", name: "Mawphlang Junction", role: "Western Relay", icon: "🌲", coords: [25.455, 91.765], elevation_m: 1810 },
  { id: "laitlyngkot", name: "Laitlyngkot Junction", role: "Ridge Relay", icon: "⛰️", coords: [25.448, 91.920], elevation_m: 1780 },
  { id: "pynursla", name: "Pynursla Ridge", role: "Southern Ridge", icon: "🏔️", coords: [25.330, 91.912], elevation_m: 1420 },
  { id: "cherrapunji", name: "Cherrapunji (Sohra)", role: "High Rain Escarpment", icon: "🌧️", coords: [25.275, 91.728], elevation_m: 1430 },
  { id: "mawsynram", name: "Mawsynram Station", role: "Extreme Rain Zone", icon: "⛈️", coords: [25.295, 91.582], elevation_m: 1400 },
  { id: "dawki", name: "Dawki Border Port", role: "Export & River Gateway", icon: "🌊", coords: [25.185, 92.025], elevation_m: 120 },
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

  // Extract unique graph nodes from genuine road geometry
  const allNodes = Array.from(adj.keys()).map(keyToPoint);

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
