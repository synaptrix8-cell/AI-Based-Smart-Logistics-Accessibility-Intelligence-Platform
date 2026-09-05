"""
Risk Scoring Endpoints — Setu Risk Engine
Handles multi-factor assessment based on weather, slope, and field reports.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List

from services.weather import fetch_weather_for_point
from services.risk_calculator import calculate_segment_risk
from services.graph_router import router_instance, INITIAL_SEGMENTS

router = APIRouter()

# Slope estimates for key East Khasi Hills corridors
SLOPE_ESTIMATES = {
    "seg-001": 8.0,    # Nongpoh approach
    "seg-002": 5.0,    # Umiam lake
    "seg-003": 28.5,   # Steep descent
    "seg-004": 12.0,   # Upper Shillong
    "seg-005": 6.0,    # City center
    "seg-006": 18.0,   # Laitlyngkot approach
    "seg-007": 24.0,   # Pynursla ridge
    "seg-008": 32.0,   # Mawsynram approach (steep & wet)
    "seg-009": 36.5,   # Cherrapunji landslide gorge
    "seg-010": 34.0,   # Nongriat descent
    "seg-011": 10.0,
    "seg-012": 14.0,
    "seg-013": 12.0,
    "seg-014": 16.0,
    "seg-015": 8.0,
}


@router.get("/segments")
async def get_all_risk_scores() -> Dict[str, Any]:
    """
    Returns all monitored road segments with active risk scores,
    factors breakdown, and geometry coordinates for mapping.
    """
    results: List[Dict[str, Any]] = []

    for seg in INITIAL_SEGMENTS:
        seg_id = seg["id"]
        mid_coord = seg["coords"][len(seg["coords"]) // 2]
        lng, lat = mid_coord[0], mid_coord[1]

        weather = await fetch_weather_for_point(lat, lng)
        slope = SLOPE_ESTIMATES.get(seg_id, 15.0)

        # Baseline active reports for demo (Mawsynram/Cherra segments get realistic reports)
        report_count = 2 if seg_id in ["seg-008", "seg-009"] else 0

        risk_data = calculate_segment_risk(
            rainfall_mm=weather["rainfall_mm"],
            slope_deg=slope,
            report_count=report_count,
            base_risk=seg["base_risk"],
        )

        # Update in-memory graph router
        router_instance.update_risk_score(seg_id, risk_data["score"])

        results.append({
            "id": seg_id,
            "name": seg["name"],
            "highway_ref": seg["highway_ref"],
            "length_km": seg["length_km"],
            "coordinates": seg["coords"],
            "risk_score": risk_data["score"],
            "risk_level": risk_data["level"],
            "weather": weather,
            "factors": risk_data["factors"],
        })

    return {
        "status": "success",
        "district": "East Khasi Hills",
        "total_segments": len(results),
        "segments": results,
    }


@router.get("/segments/{segment_id}")
async def get_segment_risk(segment_id: str) -> Dict[str, Any]:
    """
    Detailed risk score and weather assessment for a single segment.
    """
    seg = next((s for s in INITIAL_SEGMENTS if s["id"] == segment_id), None)
    if not seg:
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found.")

    mid_coord = seg["coords"][len(seg["coords"]) // 2]
    weather = await fetch_weather_for_point(mid_coord[1], mid_coord[0])
    slope = SLOPE_ESTIMATES.get(segment_id, 15.0)
    report_count = 2 if segment_id in ["seg-008", "seg-009"] else 0

    risk_data = calculate_segment_risk(
        rainfall_mm=weather["rainfall_mm"],
        slope_deg=slope,
        report_count=report_count,
        base_risk=seg["base_risk"],
    )

    return {
        "id": segment_id,
        "name": seg["name"],
        "highway_ref": seg["highway_ref"],
        "length_km": seg["length_km"],
        "coordinates": seg["coords"],
        "risk": risk_data,
        "weather": weather,
    }


@router.post("/recompute")
async def recompute_risk_scores() -> Dict[str, Any]:
    """
    Manually triggers full multi-factor risk recalculation across all road segments.
    Broadcasts results to routing graph.
    """
    updated = 0
    for seg in INITIAL_SEGMENTS:
        seg_id = seg["id"]
        mid = seg["coords"][len(seg["coords"]) // 2]
        weather = await fetch_weather_for_point(mid[1], mid[0])
        slope = SLOPE_ESTIMATES.get(seg_id, 15.0)
        report_count = 2 if seg_id in ["seg-008", "seg-009"] else 0

        risk_data = calculate_segment_risk(
            rainfall_mm=weather["rainfall_mm"],
            slope_deg=slope,
            report_count=report_count,
            base_risk=seg["base_risk"],
        )
        router_instance.update_risk_score(seg_id, risk_data["score"])
        updated += 1

    return {
        "status": "success",
        "message": f"Successfully recomputed risk scores for {updated} segments.",
        "segments_updated": updated,
    }
