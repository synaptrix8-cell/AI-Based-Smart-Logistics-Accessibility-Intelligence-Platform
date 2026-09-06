"""
Convert OSRM segment geometries JSON into updated TypeScript road-segments.ts
"""
import json

data = json.load(open("scripts/osrm_segment_geometries.json"))

lines = []
lines.append('/**')
lines.append(' * Road Network Data & Client-Side Safe Routing Algorithm')
lines.append(' * Setu - Smart Logistics & Accessibility Intelligence Platform')
lines.append(' *')
lines.append(' * Real highway geometries from OpenStreetMap / OSRM driving engine.')
lines.append(' * Every coordinate follows the actual asphalt road surface.')
lines.append(' */')
lines.append('')
lines.append('export interface RoadSegmentData {')
lines.append('  id: string;')
lines.append('  name: string;')
lines.append('  highway_ref: string;')
lines.append('  length_km: number;')
lines.append('  base_risk: number;')
lines.append('  risk_score: number;')
lines.append('  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";')
lines.append('  coordinates: [number, number][]; // [lng, lat]')
lines.append('  factors: {')
lines.append('    rainfall_mm: number;')
lines.append('    slope_deg: number;')
lines.append('    active_reports: number;')
lines.append('  };')
lines.append('}')
lines.append('')
lines.append('export const EAST_KHASI_HILLS_SEGMENTS: RoadSegmentData[] = [')

for seg in data:
    lines.append('  {')
    # Escape special chars in name
    name = seg["name"].replace('"', '\\"')
    lines.append(f'    id: "{seg["id"]}",')
    lines.append(f'    name: "{name}",')
    lines.append(f'    highway_ref: "{seg["highway_ref"]}",')
    lines.append(f'    length_km: {seg["length_km"]},')
    lines.append(f'    base_risk: {seg["base_risk"]},')
    lines.append(f'    risk_score: {seg["risk_score"]},')
    lines.append(f'    risk_level: "{seg["risk_level"]}",')
    lines.append('    coordinates: [')
    
    coords = seg["coordinates"]
    # Write coordinates in compact multi-line format (5 per line)
    for i in range(0, len(coords), 5):
        chunk = coords[i:i+5]
        parts = [f'[{c[0]}, {c[1]}]' for c in chunk]
        line = '      ' + ', '.join(parts) + ','
        lines.append(line)
    
    lines.append('    ],')
    f = seg["factors"]
    lines.append(f'    factors: {{ rainfall_mm: {f["rainfall_mm"]}, slope_deg: {f["slope_deg"]}, active_reports: {f["active_reports"]} }},')
    lines.append('  },')

lines.append('];')
lines.append('')

# Now append the rest of the original file (boundary, hubs, getRiskColor, Dijkstra)
# Read these from the original file
with open("frontend/src/lib/data/road-segments.ts", "r", encoding="utf-8") as f:
    original = f.read()

# Find the boundary section and everything after
boundary_marker = "// District boundary polygon"
idx = original.find(boundary_marker)
if idx >= 0:
    rest = original[idx:]
    lines.append(rest)

output = '\n'.join(lines)

with open("frontend/src/lib/data/road-segments.ts", "w", encoding="utf-8") as f:
    f.write(output)

# Stats
total_pts = sum(len(s["coordinates"]) for s in data)
print(f"Updated road-segments.ts with {len(data)} segments, {total_pts} total coordinate points")
print(f"File size: {len(output)} bytes")
