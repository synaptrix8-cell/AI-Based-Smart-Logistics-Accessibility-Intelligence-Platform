"""
Graph Router Service — NetworkX Dijkstra & A* Safe-Routing for Setu.
Calculates shortest route vs. risk-penalized safe route across NER road network.
"""

import math
from typing import Dict, List, Any, Tuple, Optional
import networkx as nx

# Seed road network definitions for East Khasi Hills (matches Migration 005)
INITIAL_SEGMENTS = [
    {
        "id": "seg-001",
        "name": "Nongpoh – Umiam Approach",
        "highway_ref": "NH6",
        "length_km": 6.2,
        "base_risk": 0.35,
        "coords": [[91.765, 25.891], [91.780, 25.870], [91.795, 25.848]],
    },
    {
        "id": "seg-002",
        "name": "Umiam Lake Bypass",
        "highway_ref": "NH6",
        "length_km": 7.8,
        "base_risk": 0.25,
        "coords": [[91.795, 25.848], [91.830, 25.830], [91.860, 25.815]],
    },
    {
        "id": "seg-003",
        "name": "Umiam – Upper Shillong Descent",
        "highway_ref": "NH6",
        "length_km": 4.5,
        "base_risk": 0.65,
        "coords": [[91.860, 25.815], [91.875, 25.795], [91.882, 25.780]],
    },
    {
        "id": "seg-004",
        "name": "Upper Shillong – Laitumkhrah",
        "highway_ref": "NH6",
        "length_km": 5.1,
        "base_risk": 0.30,
        "coords": [[91.882, 25.780], [91.876, 25.572], [91.884, 25.565]],
    },
    {
        "id": "seg-005",
        "name": "Shillong Police Bazaar Bypass",
        "highway_ref": "NH6",
        "length_km": 3.0,
        "base_risk": 0.20,
        "coords": [[91.884, 25.565], [91.893, 25.555], [91.900, 25.548]],
    },
    {
        "id": "seg-006",
        "name": "Shillong – Laitlyngkot",
        "highway_ref": "NH40",
        "length_km": 8.3,
        "base_risk": 0.45,
        "coords": [[91.900, 25.548], [91.920, 25.530], [91.945, 25.510]],
    },
    {
        "id": "seg-007",
        "name": "Laitlyngkot – Pynursla",
        "highway_ref": "NH40",
        "length_km": 10.2,
        "base_risk": 0.55,
        "coords": [[91.945, 25.510], [91.980, 25.480], [92.010, 25.450]],
    },
    {
        "id": "seg-008",
        "name": "Pynursla – Mawsynram Approach",
        "highway_ref": "NH40",
        "length_km": 9.1,
        "base_risk": 0.75,
        "coords": [[92.010, 25.450], [92.040, 25.430], [92.060, 25.410]],
    },
    {
        "id": "seg-009",
        "name": "Mawsynram – Cherrapunji Road",
        "highway_ref": "NH40",
        "length_km": 7.6,
        "base_risk": 0.85,
        "coords": [[91.720, 25.300], [91.735, 25.290], [91.750, 25.280]],
    },
    {
        "id": "seg-010",
        "name": "Cherrapunji – Nongriat Descent",
        "highway_ref": "NH40",
        "length_km": 5.4,
        "base_risk": 0.80,
        "coords": [[91.750, 25.280], [91.765, 25.265], [91.780, 25.250]],
    },
    {
        "id": "seg-011",
        "name": "Mawlai – Nongthymmai Link",
        "highway_ref": "Local",
        "length_km": 3.8,
        "base_risk": 0.40,
        "coords": [[91.850, 25.590], [91.865, 25.580], [91.875, 25.572]],
    },
    {
        "id": "seg-012",
        "name": "Laban – Mawprem Road",
        "highway_ref": "Local",
        "length_km": 3.2,
        "base_risk": 0.35,
        "coords": [[91.880, 25.560], [91.870, 25.575], [91.860, 25.585]],
    },
    {
        "id": "seg-013",
        "name": "Shillong – Jowai Road Start",
        "highway_ref": "NH44",
        "length_km": 6.9,
        "base_risk": 0.40,
        "coords": [[91.900, 25.548], [91.930, 25.550], [91.960, 25.555]],
    },
    {
        "id": "seg-014",
        "name": "Smit – Nongkrem Sacred Grove Road",
        "highway_ref": "Local",
        "length_km": 4.5,
        "base_risk": 0.50,
        "coords": [[91.840, 25.600], [91.830, 25.615], [91.820, 25.630]],
    },
    {
        "id": "seg-015",
        "name": "Cherrapunji Town Bypass",
        "highway_ref": "NH40",
        "length_km": 3.1,
        "base_risk": 0.40,
        "coords": [[91.750, 25.280], [91.745, 25.275], [91.730, 25.270]],
    },
    {
        "id": "seg-016",
        "name": "Shillong – Mawphlang – Sohra Highway",
        "highway_ref": "SH5",
        "length_km": 28.5,
        "base_risk": 0.35,
        "coords": [[91.876, 25.572], [91.830, 25.460], [91.760, 25.360], [91.720, 25.300]],
    },
    {
        "id": "seg-017",
        "name": "Laitlyngkot – Cherrapunji Scenic Link",
        "highway_ref": "MDR",
        "length_km": 31.2,
        "base_risk": 0.50,
        "coords": [[91.945, 25.510], [91.880, 25.400], [91.810, 25.320], [91.750, 25.280]],
    },
]


def haversine_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Computes approximate distance in km between two (lng, lat) tuples."""
    lng1, lat1 = p1
    lng2, lat2 = p2
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(max(0.0, min(1.0, a))))


class RoadGraphRouter:
    """Manages the road network graph and runs safe routing algorithms."""

    def __init__(self, segments: Optional[List[Dict[str, Any]]] = None):
        self.segments = segments or INITIAL_SEGMENTS
        self.current_risk_scores: Dict[str, float] = {
            s["id"]: s["base_risk"] for s in self.segments
        }
        self.graph = nx.Graph()
        self._build_graph()

    def update_risk_score(self, segment_id: str, score: float):
        """Updates the risk score for a segment and recalculates edge weights."""
        self.current_risk_scores[segment_id] = score
        self._build_graph()

    def _build_graph(self):
        """Constructs an undirected graph where nodes are (lng, lat) coordinates."""
        self.graph.clear()

        for seg in self.segments:
            seg_id = seg["id"]
            coords = seg["coords"]
            risk = self.current_risk_scores.get(seg_id, seg["base_risk"])
            total_len = seg["length_km"]
            n_sub = max(1, len(coords) - 1)
            sub_len = total_len / n_sub

            for i in range(len(coords) - 1):
                u = (round(coords[i][0], 4), round(coords[i][1], 4))
                v = (round(coords[i + 1][0], 4), round(coords[i + 1][1], 4))

                # Weight formulas:
                # 1. distance: physical length in km
                # 2. safe_cost: distance scaled nonlinearly by risk penalty
                # High risk (e.g. 0.8) receives a significant multiplier penalty
                safe_multiplier = 1.0 + 8.0 * (risk ** 2)
                safe_cost = sub_len * safe_multiplier

                self.graph.add_edge(
                    u,
                    v,
                    segment_id=seg_id,
                    name=seg["name"],
                    highway_ref=seg.get("highway_ref", ""),
                    distance=sub_len,
                    risk=risk,
                    safe_cost=safe_cost,
                )

        # Connect nearby segments (junctions within 3km) to ensure network connectivity
        nodes = list(self.graph.nodes())
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                d = haversine_distance(nodes[i], nodes[j])
                if 0.0 < d <= 3.5 and not self.graph.has_edge(nodes[i], nodes[j]):
                    self.graph.add_edge(
                        nodes[i],
                        nodes[j],
                        segment_id="connector",
                        name="Inter-corridor Link",
                        highway_ref="Link",
                        distance=d,
                        risk=0.3,
                        safe_cost=d * (1.0 + 8.0 * (0.3 ** 2)),
                    )

    def find_nearest_node(self, lng: float, lat: float) -> Tuple[float, float]:
        """Finds the nearest road node in the graph to the provided coordinates."""
        target = (lng, lat)
        nodes = list(self.graph.nodes())
        if not nodes:
            return (lng, lat)
        return min(nodes, key=lambda n: haversine_distance(target, n))

    def compute_route(
        self,
        orig_lng: float,
        orig_lat: float,
        dest_lng: float,
        dest_lat: float,
        avoid_risk_above: float = 0.75,
    ) -> Dict[str, Any]:
        """
        Computes both the shortest route and the AI safe route avoiding hazardous segments.
        """
        orig_node = self.find_nearest_node(orig_lng, orig_lat)
        dest_node = self.find_nearest_node(dest_lng, dest_lat)

        if orig_node == dest_node:
            return {
                "success": True,
                "shortest_route": {"coordinates": [[orig_node[0], orig_node[1]]], "distance_km": 0.0, "avg_risk": 0.0},
                "safe_route": {"coordinates": [[orig_node[0], orig_node[1]]], "distance_km": 0.0, "avg_risk": 0.0},
                "risk_reduction_pct": 0.0,
            }

        try:
            # 1. Shortest route (minimizing physical distance)
            shortest_path = nx.shortest_path(self.graph, orig_node, dest_node, weight="distance")
            shortest_summary = self._summarize_path(shortest_path, weight_key="distance")

            # 2. Safe route (minimizing risk-penalized cost)
            # Temporarily apply extreme penalty to segments above avoid_risk_above threshold
            for u, v, d in self.graph.edges(data=True):
                edge_risk = d.get("risk", 0.0)
                if edge_risk >= avoid_risk_above:
                    d["safe_cost"] = d["distance"] * (1.0 + 8.0 * (edge_risk ** 2)) * 15.0

            safe_path = nx.shortest_path(self.graph, orig_node, dest_node, weight="safe_cost")
            safe_summary = self._summarize_path(safe_path, weight_key="safe_cost")

            # Restore normal edge weights
            for u, v, d in self.graph.edges(data=True):
                edge_risk = d.get("risk", 0.0)
                d["safe_cost"] = d["distance"] * (1.0 + 8.0 * (edge_risk ** 2))

            risk_diff = shortest_summary["avg_risk"] - safe_summary["avg_risk"]
            reduction_pct = max(0.0, round((risk_diff / max(0.01, shortest_summary["avg_risk"])) * 100, 1))

            return {
                "success": True,
                "origin": {"lng": orig_node[0], "lat": orig_node[1]},
                "destination": {"lng": dest_node[0], "lat": dest_node[1]},
                "shortest_route": shortest_summary,
                "safe_route": safe_summary,
                "risk_reduction_pct": reduction_pct,
                "recommendation": "Safe Route Recommended" if safe_summary["avg_risk"] < shortest_summary["avg_risk"] else "Direct Route is Safe",
            }

        except nx.NetworkXNoPath:
            return {
                "success": False,
                "error": "No viable road path found between selected coordinates.",
            }

    def _summarize_path(self, path: List[Tuple[float, float]], weight_key: str) -> Dict[str, Any]:
        """Calculates distance, coordinates, and average risk across a path."""
        coords = [[n[0], n[1]] for n in path]
        total_dist = 0.0
        risk_weighted_sum = 0.0
        segments_used = []

        for i in range(len(path) - 1):
            edge_data = self.graph.get_edge_data(path[i], path[i + 1]) or {}
            d = edge_data.get("distance", 0.0)
            r = edge_data.get("risk", 0.2)
            total_dist += d
            risk_weighted_sum += d * r
            seg_name = edge_data.get("name")
            if seg_name and seg_name not in segments_used:
                segments_used.append(seg_name)

        avg_risk = round(risk_weighted_sum / max(0.001, total_dist), 3) if total_dist > 0 else 0.0

        return {
            "coordinates": coords,
            "distance_km": round(total_dist, 2),
            "avg_risk": avg_risk,
            "risk_level": "LOW" if avg_risk < 0.4 else "MEDIUM" if avg_risk < 0.7 else "HIGH",
            "corridors": segments_used,
        }

    def get_stats(self) -> Dict[str, Any]:
        """Returns statistics of the current road network."""
        return {
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges(),
            "district": "East Khasi Hills (Shillong corridor)",
            "monitored_segments": len(self.segments),
            "is_connected": nx.is_connected(self.graph) if self.graph.nodes else False,
        }


# Global singleton instance
router_instance = RoadGraphRouter()
