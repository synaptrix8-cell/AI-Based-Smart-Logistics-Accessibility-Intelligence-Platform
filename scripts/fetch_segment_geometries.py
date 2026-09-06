"""
Fetch Real OSRM Road-Following Geometries for All East Khasi Hills Road Segments
=================================================================================
Queries the public OSRM driving API to get precise, road-hugging coordinate arrays
for every corridor in road-segments.ts. Outputs a JSON file with the upgraded geometries.
"""

import json
import time
import urllib.request
import urllib.parse

# Each segment defined by: id, name, highway_ref, start [lng, lat], end [lng, lat],
# plus optional via waypoints to force the route along the correct highway.
# Coordinates are [longitude, latitude] as OSRM expects.
SEGMENTS = [
    {
        "id": "seg-001",
        "name": "Nongpoh - Umsning Highway (NH6 North)",
        "highway_ref": "NH6",
        "waypoints": [
            [91.765, 25.891],  # Nongpoh
            [91.870, 25.780],  # Umsning area
            [91.902, 25.752],  # Near Umiam approach
        ],
        "length_km": 17.5,
        "base_risk": 0.32,
        "risk_score": 0.32,
        "risk_level": "LOW",
        "factors": {"rainfall_mm": 12.0, "slope_deg": 9.0, "active_reports": 0},
    },
    {
        "id": "seg-002",
        "name": "Umsning - Umiam Lake Sector (NH6)",
        "highway_ref": "NH6",
        "waypoints": [
            [91.902, 25.752],  # Umsning
            [91.895, 25.660],  # Umiam Dam
        ],
        "length_km": 11.2,
        "base_risk": 0.25,
        "risk_score": 0.24,
        "risk_level": "LOW",
        "factors": {"rainfall_mm": 14.5, "slope_deg": 7.5, "active_reports": 0},
    },
    {
        "id": "seg-003",
        "name": "Umiam - Upper Shillong Descent (NH6 Direct)",
        "highway_ref": "NH6",
        "waypoints": [
            [91.895, 25.660],  # Umiam
            [91.880, 25.610],  # Mid descent
            [91.885, 25.572],  # Upper Shillong
        ],
        "length_km": 10.5,
        "base_risk": 0.65,
        "risk_score": 0.76,
        "risk_level": "HIGH",
        "factors": {"rainfall_mm": 36.4, "slope_deg": 28.5, "active_reports": 1},
    },
    {
        "id": "seg-004",
        "name": "Shillong Bypass East Arterial (NH6 Bypass)",
        "highway_ref": "NH6 Bypass",
        "waypoints": [
            [91.902, 25.752],  # Umsning junction
            [91.955, 25.720],  # Bypass mid
            [92.010, 25.650],  # Eastern bypass
            [92.035, 25.575],  # Mawryngkneng
        ],
        "length_km": 22.4,
        "base_risk": 0.22,
        "risk_score": 0.24,
        "risk_level": "LOW",
        "factors": {"rainfall_mm": 11.2, "slope_deg": 6.0, "active_reports": 0},
    },
    {
        "id": "seg-005",
        "name": "Mawryngkneng - Shillong Central (NH44 West)",
        "highway_ref": "NH44",
        "waypoints": [
            [92.035, 25.575],  # Mawryngkneng
            [91.965, 25.573],  # Midway
            [91.885, 25.572],  # Shillong Central
        ],
        "length_km": 15.1,
        "base_risk": 0.25,
        "risk_score": 0.28,
        "risk_level": "LOW",
        "factors": {"rainfall_mm": 13.0, "slope_deg": 7.0, "active_reports": 0},
    },
    {
        "id": "seg-006",
        "name": "Mawryngkneng - Laitlyngkot Freight Connector",
        "highway_ref": "Freight Bypass",
        "waypoints": [
            [92.035, 25.575],  # Mawryngkneng
            [91.985, 25.510],  # Mid
            [91.920, 25.448],  # Laitlyngkot
        ],
        "length_km": 17.8,
        "base_risk": 0.30,
        "risk_score": 0.32,
        "risk_level": "LOW",
        "factors": {"rainfall_mm": 15.0, "slope_deg": 11.0, "active_reports": 0},
    },
    {
        "id": "seg-007",
        "name": "Shillong Central - Upper Shillong (SH5 Urban)",
        "highway_ref": "SH5",
        "waypoints": [
            [91.885, 25.572],  # Shillong Central
            [91.860, 25.548],  # Mid
            [91.848, 25.535],  # Upper Shillong
        ],
        "length_km": 5.2,
        "base_risk": 0.28,
        "risk_score": 0.30,
        "risk_level": "LOW",
        "factors": {"rainfall_mm": 16.5, "slope_deg": 9.0, "active_reports": 0},
    },
    {
        "id": "seg-008",
        "name": "Upper Shillong - Mawphlang (SH5 Sector 1)",
        "highway_ref": "SH5",
        "waypoints": [
            [91.848, 25.535],  # Upper Shillong
            [91.815, 25.502],  # Mid
            [91.765, 25.455],  # Mawphlang
        ],
        "length_km": 11.5,
        "base_risk": 0.32,
        "risk_score": 0.35,
        "risk_level": "LOW",
        "factors": {"rainfall_mm": 19.0, "slope_deg": 13.0, "active_reports": 0},
    },
    {
        "id": "seg-009",
        "name": "Mawphlang - Mawkdok Dympep Gorge (SH5 Sector 2)",
        "highway_ref": "SH5",
        "waypoints": [
            [91.765, 25.455],  # Mawphlang
            [91.752, 25.370],  # Mid gorge
            [91.748, 25.340],  # Mawkdok
        ],
        "length_km": 13.8,
        "base_risk": 0.38,
        "risk_score": 0.42,
        "risk_level": "MEDIUM",
        "factors": {"rainfall_mm": 28.0, "slope_deg": 20.0, "active_reports": 0},
    },
    {
        "id": "seg-010",
        "name": "Mawkdok Valley - Cherrapunji Plateau",
        "highway_ref": "SH5",
        "waypoints": [
            [91.748, 25.340],  # Mawkdok
            [91.728, 25.275],  # Cherrapunji
        ],
        "length_km": 8.4,
        "base_risk": 0.42,
        "risk_score": 0.45,
        "risk_level": "MEDIUM",
        "factors": {"rainfall_mm": 34.0, "slope_deg": 18.0, "active_reports": 0},
    },
    {
        "id": "seg-011",
        "name": "Upper Shillong - Laitlyngkot (NH40 Ridge)",
        "highway_ref": "NH40",
        "waypoints": [
            [91.848, 25.535],  # Upper Shillong
            [91.892, 25.480],  # Mid
            [91.920, 25.448],  # Laitlyngkot
        ],
        "length_km": 12.6,
        "base_risk": 0.40,
        "risk_score": 0.44,
        "risk_level": "MEDIUM",
        "factors": {"rainfall_mm": 22.0, "slope_deg": 16.0, "active_reports": 0},
    },
    {
        "id": "seg-012",
        "name": "Laitlyngkot - Pynursla Ridge (NH40)",
        "highway_ref": "NH40",
        "waypoints": [
            [91.920, 25.448],  # Laitlyngkot
            [91.918, 25.352],  # Mid
            [91.912, 25.330],  # Pynursla
        ],
        "length_km": 14.1,
        "base_risk": 0.50,
        "risk_score": 0.55,
        "risk_level": "MEDIUM",
        "factors": {"rainfall_mm": 31.0, "slope_deg": 21.0, "active_reports": 0},
    },
    {
        "id": "seg-013",
        "name": "Pynursla - Dawki Border Highway (NH40)",
        "highway_ref": "NH40",
        "waypoints": [
            [91.912, 25.330],  # Pynursla
            [91.962, 25.260],  # Mid
            [92.025, 25.185],  # Dawki
        ],
        "length_km": 19.8,
        "base_risk": 0.52,
        "risk_score": 0.58,
        "risk_level": "MEDIUM",
        "factors": {"rainfall_mm": 36.0, "slope_deg": 24.0, "active_reports": 0},
    },
    {
        "id": "seg-014",
        "name": "Laitlyngkot - Mawkdok Valley Link (MDR27)",
        "highway_ref": "MDR27",
        "waypoints": [
            [91.920, 25.448],  # Laitlyngkot
            [91.845, 25.395],  # Mid
            [91.748, 25.340],  # Mawkdok
        ],
        "length_km": 18.9,
        "base_risk": 0.44,
        "risk_score": 0.48,
        "risk_level": "MEDIUM",
        "factors": {"rainfall_mm": 29.0, "slope_deg": 22.0, "active_reports": 0},
    },
    {
        "id": "seg-015",
        "name": "Mawphlang - Mawsynram Escarpment (SH4)",
        "highway_ref": "SH4",
        "waypoints": [
            [91.765, 25.455],  # Mawphlang
            [91.680, 25.395],  # Mid
            [91.582, 25.295],  # Mawsynram
        ],
        "length_km": 22.1,
        "base_risk": 0.60,
        "risk_score": 0.68,
        "risk_level": "MEDIUM",
        "factors": {"rainfall_mm": 42.0, "slope_deg": 27.0, "active_reports": 1},
    },
    {
        "id": "seg-016",
        "name": "Mawsynram - Cherrapunji Gorge Link",
        "highway_ref": "NH40 Link",
        "waypoints": [
            [91.582, 25.295],  # Mawsynram
            [91.660, 25.282],  # Mid
            [91.728, 25.275],  # Cherrapunji
        ],
        "length_km": 15.6,
        "base_risk": 0.78,
        "risk_score": 0.88,
        "risk_level": "CRITICAL",
        "factors": {"rainfall_mm": 56.5, "slope_deg": 36.0, "active_reports": 3},
    },
    {
        "id": "seg-017",
        "name": "Cherrapunji - Nohkalikai & Living Root Trail",
        "highway_ref": "Local",
        "waypoints": [
            [91.728, 25.275],  # Cherrapunji
            [91.702, 25.250],  # Nohkalikai
        ],
        "length_km": 4.8,
        "base_risk": 0.72,
        "risk_score": 0.82,
        "risk_level": "HIGH",
        "factors": {"rainfall_mm": 49.0, "slope_deg": 35.0, "active_reports": 2},
    },
]


def fetch_osrm_geometry(waypoints):
    """
    Query OSRM public routing API with waypoints and return the decoded
    full route geometry as a list of [lng, lat] coordinates.
    """
    coords_str = ";".join([f"{wp[0]},{wp[1]}" for wp in waypoints])
    url = f"https://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson"

    req = urllib.request.Request(url, headers={"User-Agent": "Setu-NER-Corridor-Mapper/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                coords = route["geometry"]["coordinates"]  # [[lng, lat], ...]
                distance_m = route["distance"]
                print(f"  -> Got {len(coords)} points, OSRM distance: {distance_m/1000:.1f} km")
                return coords, distance_m / 1000.0
            else:
                print(f"  -> OSRM returned no valid route: {data.get('code')}")
                return None, None
    except Exception as e:
        print(f"  -> OSRM request failed: {e}")
        return None, None


def simplify_coords(coords, max_points=120):
    """
    Downsample coordinates to at most max_points using uniform interval sampling,
    always keeping start and end points. This keeps file size reasonable while
    maintaining road-following accuracy.
    """
    if len(coords) <= max_points:
        return coords

    result = [coords[0]]
    step = (len(coords) - 1) / (max_points - 1)
    for i in range(1, max_points - 1):
        idx = int(round(i * step))
        result.append(coords[idx])
    result.append(coords[-1])
    return result


def main():
    print("=" * 70)
    print("Setu - Fetching Real OSRM Highway Geometries for East Khasi Hills")
    print("=" * 70)

    results = []
    failed = []

    for seg in SEGMENTS:
        print(f"\n[{seg['id']}] {seg['name']} ({seg['highway_ref']})")
        print(f"  Waypoints: {len(seg['waypoints'])} control points")

        coords, osrm_distance = fetch_osrm_geometry(seg["waypoints"])

        if coords:
            # Simplify to max 120 points per segment (keeps road fidelity, controls file size)
            simplified = simplify_coords(coords, max_points=120)
            # Round to 5 decimal places (1.1m precision)
            simplified = [[round(c[0], 5), round(c[1], 5)] for c in simplified]

            results.append({
                "id": seg["id"],
                "name": seg["name"],
                "highway_ref": seg["highway_ref"],
                "length_km": round(osrm_distance, 1),
                "base_risk": seg["base_risk"],
                "risk_score": seg["risk_score"],
                "risk_level": seg["risk_level"],
                "coordinates": simplified,
                "factors": seg["factors"],
                "osrm_point_count": len(coords),
                "simplified_point_count": len(simplified),
            })
        else:
            failed.append(seg["id"])
            # Keep original waypoints as fallback
            results.append({
                "id": seg["id"],
                "name": seg["name"],
                "highway_ref": seg["highway_ref"],
                "length_km": seg["length_km"],
                "base_risk": seg["base_risk"],
                "risk_score": seg["risk_score"],
                "risk_level": seg["risk_level"],
                "coordinates": seg["waypoints"],
                "factors": seg["factors"],
                "osrm_point_count": 0,
                "simplified_point_count": len(seg["waypoints"]),
            })

        # Rate limit: be respectful to the public OSRM server
        time.sleep(1.0)

    # Write output
    output_path = "scripts/osrm_segment_geometries.json"
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n{'=' * 70}")
    print(f"DONE: {len(results)} segments processed, {len(failed)} failed")
    if failed:
        print(f"Failed segments: {', '.join(failed)}")
    print(f"Output: {output_path}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
