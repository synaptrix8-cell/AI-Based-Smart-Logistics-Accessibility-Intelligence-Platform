"""
Fetch road network data from OpenStreetMap via Overpass API
for East Khasi Hills district (Shillong corridor, NH6/NH40).

Outputs:
- east_khasi_hills_roads.geojson — GeoJSON FeatureCollection of road segments
- seed_roads.sql — SQL INSERT statements for the road_segments table

Usage:
    python fetch_osm_roads.py

This script queries the Overpass API for highways within the East Khasi Hills
bounding box and converts them to PostGIS-ready SQL.
"""

import json
import sys
import urllib.request
import urllib.parse
from pathlib import Path

# East Khasi Hills approximate bounding box
# (south, west, north, east)
BBOX = (25.1, 91.6, 25.7, 92.1)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Query for trunk, primary, and secondary highways in the bounding box
OVERPASS_QUERY = f"""
[out:json][timeout:300];
(
  way["highway"~"trunk|primary|secondary"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out geom;
"""

DISTRICT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


def fetch_overpass_data():
    """Query the Overpass API and return parsed JSON."""
    print(f"Querying Overpass API for roads in bbox {BBOX}...")
    
    data = urllib.parse.urlencode({"data": OVERPASS_QUERY}).encode("utf-8")
    req = urllib.request.Request(OVERPASS_URL, data=data)
    req.add_header("User-Agent", "Setu/0.1 (logistics-platform)")
    
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
            print(f"Received {len(result.get('elements', []))} elements")
            return result
    except Exception as e:
        print(f"Error fetching data: {e}")
        sys.exit(1)


def elements_to_geojson(elements):
    """Convert Overpass elements to GeoJSON FeatureCollection."""
    features = []
    
    for elem in elements:
        if elem.get("type") != "way" or "geometry" not in elem:
            continue
        
        coords = [
            [node["lon"], node["lat"]]
            for node in elem["geometry"]
        ]
        
        if len(coords) < 2:
            continue
        
        tags = elem.get("tags", {})
        
        feature = {
            "type": "Feature",
            "properties": {
                "osm_id": elem["id"],
                "name": tags.get("name", "Unnamed Road"),
                "highway": tags.get("highway", ""),
                "ref": tags.get("ref", ""),
                "surface": tags.get("surface", "paved"),
                "lanes": tags.get("lanes", "2"),
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features,
    }


def geojson_to_sql(geojson, max_segments=50):
    """
    Convert GeoJSON features to SQL INSERT statements.
    Limits to max_segments to keep the seed manageable.
    """
    lines = [
        "-- Auto-generated from OpenStreetMap via fetch_osm_roads.py",
        "-- Run this AFTER 002_create_tables.sql",
        "",
    ]
    
    features = geojson["features"][:max_segments]
    
    for i, feature in enumerate(features):
        props = feature["properties"]
        coords = feature["geometry"]["coordinates"]
        
        # Build WKT linestring
        coord_str = ", ".join(f"{c[0]} {c[1]}" for c in coords)
        wkt = f"LINESTRING({coord_str})"
        
        # Estimate base_risk from road class
        highway = props.get("highway", "")
        if highway == "trunk":
            base_risk = 0.3
        elif highway == "primary":
            base_risk = 0.4
        else:
            base_risk = 0.5
        
        name = props.get("name", "Unnamed").replace("'", "''")
        ref = props.get("ref", "").replace("'", "''")
        
        # Approximate length (simplified — real calc would use PostGIS ST_Length)
        if len(coords) >= 2:
            # Very rough km estimate using degree diff * 111
            dx = coords[-1][0] - coords[0][0]
            dy = coords[-1][1] - coords[0][1]
            length_km = round(((dx**2 + dy**2) ** 0.5) * 111, 2)
        else:
            length_km = 0
        
        lines.append(
            f"INSERT INTO public.road_segments "
            f"(district_id, geometry, name, highway_ref, base_risk, length_km) VALUES ("
            f"'{DISTRICT_ID}', "
            f"ST_GeomFromText('{wkt}', 4326), "
            f"'{name}', "
            f"'{ref}', "
            f"{base_risk}, "
            f"{length_km});"
        )
    
    return "\n".join(lines)


def main():
    output_dir = Path(__file__).parent
    
    # Fetch from Overpass
    data = fetch_overpass_data()
    elements = data.get("elements", [])
    
    if not elements:
        print("No road elements found. Check the bounding box and query.")
        sys.exit(1)
    
    # Convert to GeoJSON
    geojson = elements_to_geojson(elements)
    
    geojson_path = output_dir / "east_khasi_hills_roads.geojson"
    with open(geojson_path, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"Wrote {len(geojson['features'])} features to {geojson_path}")
    
    # Generate SQL
    sql = geojson_to_sql(geojson)
    sql_path = output_dir / "seed_roads_from_osm.sql"
    with open(sql_path, "w") as f:
        f.write(sql)
    print(f"Wrote SQL to {sql_path}")
    
    print("\nDone! You can now:")
    print(f"  1. Review the GeoJSON: {geojson_path}")
    print(f"  2. Run the SQL against your Supabase DB: {sql_path}")


if __name__ == "__main__":
    main()
