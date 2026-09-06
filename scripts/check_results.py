import json

data = json.load(open("scripts/osrm_segment_geometries.json"))
for s in data:
    name = s["name"][:50]
    km = s["length_km"]
    pts = s["simplified_point_count"]
    raw = s["osrm_point_count"]
    print(f"{s['id']} | {name:50s} | {km:6.1f} km | {pts:4d} pts (raw: {raw})")
