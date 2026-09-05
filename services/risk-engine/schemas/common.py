"""
Shared Pydantic schemas for API responses and common data structures.
"""

from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime


class APIResponse(BaseModel):
    """Standard API response wrapper."""
    success: bool = True
    message: str = ""
    data: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    success: bool = False
    message: str
    detail: Optional[str] = None


class RiskScoreOut(BaseModel):
    """Risk score for a road segment."""
    segment_id: str
    score: float = Field(..., ge=0.0, le=1.0)
    computed_at: datetime
    factors: Dict[str, Any] = {}


class SegmentOut(BaseModel):
    """Road segment with geometry and current risk."""
    id: str
    name: Optional[str]
    highway_ref: Optional[str]
    district_id: str
    base_risk: float
    current_risk: Optional[float] = None
    geometry: Dict[str, Any]  # GeoJSON


class RouteOut(BaseModel):
    """Computed safe route result."""
    origin: Dict[str, float]
    destination: Dict[str, float]
    path_geojson: Dict[str, Any]  # GeoJSON LineString
    total_distance_km: float
    total_risk_score: float
    segments_used: List[str]
    avoided_segments: List[str]


class ReportIn(BaseModel):
    """Input for creating a hazard report (from SMS webhook or API)."""
    category: str = Field(..., pattern="^(landslide|flood|road_damage|congestion|other)$")
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    encrypted_payload: Optional[str] = None  # base64 AES-GCM ciphertext
    iv: Optional[str] = None  # base64 initialization vector
    segment_id: Optional[str] = None
