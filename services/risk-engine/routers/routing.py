"""
Safe-Route Computation Endpoints — Setu Risk Engine
Calculates Dijkstra & A* safe paths avoiding high-risk segments.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

from services.graph_router import router_instance

router = APIRouter()


class RouteRequest(BaseModel):
    origin_lat: float = Field(..., description="Origin latitude, e.g. 25.891 (Nongpoh)")
    origin_lng: float = Field(..., description="Origin longitude, e.g. 91.765")
    dest_lat: float = Field(..., description="Destination latitude, e.g. 25.250 (Cherrapunji/Nongriat)")
    dest_lng: float = Field(..., description="Destination longitude, e.g. 91.780")
    avoid_risk_above: Optional[float] = Field(
        0.70,
        description="Threshold above which roads receive heavy avoidance penalties (0.0 - 1.0)",
    )


@router.post("/safe-route")
async def compute_safe_route(request: RouteRequest) -> Dict[str, Any]:
    """
    Computes both the direct shortest route and the AI risk-penalized safe route.
    Returns GeoJSON coordinates, distance, and risk comparison.
    """
    result = router_instance.compute_route(
        orig_lng=request.origin_lng,
        orig_lat=request.origin_lat,
        dest_lng=request.dest_lng,
        dest_lat=request.dest_lat,
        avoid_risk_above=request.avoid_risk_above or 0.70,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to find road route."),
        )

    return result


@router.get("/graph-stats")
async def get_graph_stats() -> Dict[str, Any]:
    """
    Returns statistics about the road network graph.
    """
    return router_instance.get_stats()
