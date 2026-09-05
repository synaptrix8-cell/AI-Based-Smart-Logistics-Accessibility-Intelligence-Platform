"""
Risk Calculator Engine — Computes multi-factor risk scores for road segments.
"""

from typing import Dict, Any


def calculate_segment_risk(
    rainfall_mm: float,
    slope_deg: float,
    report_count: int,
    base_risk: float = 0.2,
    historical_incidents: int = 0,
) -> Dict[str, Any]:
    """
    Computes road risk score between 0.0 (Safe) and 1.0 (Impassable/Extreme Hazard).

    Factors:
    - rainfall_mm: Real-time precipitation (0 - 50+ mm) -> normalized weight 0.35
    - slope_deg: Average terrain gradient (0 - 45 deg) -> normalized weight 0.25
    - report_count: Active hazard reports within 6 hours -> normalized weight 0.25
    - base_risk / history: Intrinsic structural vulnerability -> normalized weight 0.15
    """
    # 1. Rainfall factor (0 mm -> 0.0; 50mm+ -> 1.0)
    rain_factor = min(1.0, max(0.0, rainfall_mm / 45.0))

    # 2. Slope factor (0 deg -> 0.0; 35 deg+ -> 1.0)
    slope_factor = min(1.0, max(0.0, slope_deg / 35.0))

    # 3. Report factor (0 reports -> 0.0; 3+ reports -> 1.0)
    report_factor = min(1.0, max(0.0, report_count / 3.0))

    # 4. History factor (0 incidents -> 0.0; 5+ incidents -> 1.0)
    history_factor = min(1.0, max(0.0, historical_incidents / 5.0))
    intrinsic_risk = max(base_risk, history_factor * 0.5)

    # Weighted calculation
    score = (
        0.35 * rain_factor
        + 0.25 * slope_factor
        + 0.25 * report_factor
        + 0.15 * intrinsic_risk
    )

    # Nonlinear penalty for compound disaster risk (e.g. heavy rain on steep slope)
    if rain_factor > 0.6 and slope_factor > 0.6:
        score += 0.15

    final_score = round(min(1.0, max(0.0, score)), 3)

    if final_score < 0.4:
        level = "LOW"
    elif final_score < 0.7:
        level = "MEDIUM"
    elif final_score < 0.85:
        level = "HIGH"
    else:
        level = "CRITICAL"

    return {
        "score": final_score,
        "level": level,
        "factors": {
            "rainfall_mm": round(rainfall_mm, 2),
            "rain_factor": round(rain_factor, 2),
            "slope_deg": round(slope_deg, 1),
            "slope_factor": round(slope_factor, 2),
            "active_reports": report_count,
            "report_factor": round(report_factor, 2),
            "base_risk": round(base_risk, 2),
        },
    }
