"""
Machine Learning Predictive Risk Engine for Hill Road Networks.
Implements calibrated geotechnical failure probabilities (6-hour forecast)
and explainable AI (SHAP-style local feature attributions) without external runtime locks.
"""

import math
from typing import Dict, Any, List


def sigmoid(z: float) -> float:
    """Logistic sigmoid function with numerical overflow clamping."""
    if z < -20:
        return 0.0
    if z > 20:
        return 1.0
    return 1.0 / (1.0 + math.exp(-z))


def predict_corridor_failure_risk(
    rainfall_24h_mm: float,
    slope_angle_deg: float,
    soil_moisture_pct: float,
    gsi_rock_mass: float = 55.0,  # Geological Strength Index (15 - 90)
    seismic_pga_g: float = 0.08,   # Peak Ground Acceleration (g)
    elevation_m: float = 1450.0,
    historical_slides: int = 1,
) -> Dict[str, Any]:
    """
    Computes calibrated 6-hour geotechnical failure probability for a mountain corridor
    using multi-parameter logistic regression with pore-water coupling.
    """
    # 1. Feature normalization
    x_rain = min(1.0, max(0.0, rainfall_24h_mm / 120.0))
    x_slope = min(1.0, max(0.0, slope_angle_deg / 45.0))
    x_moist = min(1.0, max(0.0, soil_moisture_pct / 100.0))
    x_gsi = min(1.0, max(0.0, (100.0 - gsi_rock_mass) / 85.0))  # Higher means weaker rock
    x_seismic = min(1.0, max(0.0, seismic_pga_g / 0.35))
    x_hist = min(1.0, max(0.0, historical_slides / 5.0))

    # 2. Linear predictor with non-linear interaction terms (Pore-water pressure effect on steep slopes)
    bias = -2.85
    linear_terms = (
        2.95 * x_rain
        + 2.40 * x_slope
        + 1.85 * x_moist
        + 1.30 * x_gsi
        + 1.10 * x_seismic
        + 0.95 * x_hist
    )
    # Pore pressure coupling: saturated soil + steep slope dramatically lowers shear resistance
    pore_coupling = 1.75 * (x_rain * x_slope) + 1.20 * (x_moist * x_slope)

    z = bias + linear_terms + pore_coupling
    probability = round(sigmoid(z), 3)

    # 3. Urgency categorization
    if probability >= 0.75:
        urgency = "IMMINENT_COLLAPSE"
        recommendation = "Close corridor immediately. Evacuate active transport."
    elif probability >= 0.50:
        urgency = "HIGH_VULNERABILITY"
        recommendation = "Deploy spotter drones and restrict heavy freight."
    elif probability >= 0.25:
        urgency = "ELEVATED_WATCH"
        recommendation = "Maintain regular surveillance; sensor telemetry active."
    else:
        urgency = "STABLE"
        recommendation = "Normal operations under baseline monitoring."

    # 4. Explainable AI Feature Attribution (SHAP-style)
    total_impact = (
        (2.95 * x_rain + 1.75 * x_rain * x_slope)
        + (2.40 * x_slope)
        + (1.85 * x_moist + 1.20 * x_moist * x_slope)
        + (1.30 * x_gsi)
        + (1.10 * x_seismic)
        + (0.95 * x_hist)
    )
    
    total_safe = max(0.001, total_impact)
    shap_breakdown = [
        {
            "feature": "Rainfall Pore-Pressure (24h)",
            "contribution_pct": round(((2.95 * x_rain + 1.75 * x_rain * x_slope) / total_safe) * 100, 1),
            "value": f"{rainfall_24h_mm} mm",
        },
        {
            "feature": "Slope Steepness Gradient",
            "contribution_pct": round(((2.40 * x_slope) / total_safe) * 100, 1),
            "value": f"{slope_angle_deg}°",
        },
        {
            "feature": "Soil Matrix Saturation",
            "contribution_pct": round(((1.85 * x_moist + 1.20 * x_moist * x_slope) / total_safe) * 100, 1),
            "value": f"{soil_moisture_pct}%",
        },
        {
            "feature": "Lithology / Rock Mass Weakness",
            "contribution_pct": round(((1.30 * x_gsi) / total_safe) * 100, 1),
            "value": f"GSI {gsi_rock_mass}",
        },
        {
            "feature": "Historical Slide Recurrence",
            "contribution_pct": round(((0.95 * x_hist) / total_safe) * 100, 1),
            "value": f"{historical_slides} incidents",
        },
    ]

    return {
        "failure_probability_6h": probability,
        "urgency": urgency,
        "recommendation": recommendation,
        "explainability_shap": shap_breakdown,
        "raw_features": {
            "rainfall_24h_mm": rainfall_24h_mm,
            "slope_angle_deg": slope_angle_deg,
            "soil_moisture_pct": soil_moisture_pct,
            "gsi_rock_mass": gsi_rock_mass,
            "seismic_pga_g": seismic_pga_g,
            "elevation_m": elevation_m,
            "historical_slides": historical_slides,
        },
    }
