"""
Weather Service — OpenWeatherMap Integration with NER Station Fallbacks
"""

import httpx
from typing import Dict, Any
from core.config import settings

# Default baseline weather data for East Khasi Hills stations
# In case of API downtime or missing API key during local dev/demo
DEFAULT_NER_WEATHER = {
    "Shillong": {"rainfall_mm": 12.4, "temp_c": 19.5, "humidity": 82, "condition": "Light Rain"},
    "Cherrapunji": {"rainfall_mm": 48.6, "temp_c": 18.0, "humidity": 94, "condition": "Heavy Rain"},
    "Dawki": {"rainfall_mm": 22.1, "temp_c": 24.2, "humidity": 78, "condition": "Moderate Rain"},
    "Nongpoh": {"rainfall_mm": 8.0, "temp_c": 26.1, "humidity": 70, "condition": "Cloudy"},
}


async def fetch_weather_for_point(lat: float, lng: float) -> Dict[str, Any]:
    """
    Fetch real-time weather from OpenWeatherMap API for given coordinates.
    Falls back to regional station estimates if API key is missing or request fails.
    """
    if settings.OPENWEATHERMAP_API_KEY:
        try:
            url = "https://api.openweathermap.org/data/2.5/weather"
            params = {
                "lat": lat,
                "lon": lng,
                "appid": settings.OPENWEATHERMAP_API_KEY,
                "units": "metric",
            }
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    rain_data = data.get("rain", {})
                    rainfall_1h = rain_data.get("1h", 0.0)
                    rainfall_3h = rain_data.get("3h", 0.0)
                    rainfall_mm = max(rainfall_1h, rainfall_3h / 3.0 if rainfall_3h else 0.0)

                    return {
                        "rainfall_mm": round(rainfall_mm, 2),
                        "temp_c": data.get("main", {}).get("temp", 20.0),
                        "humidity": data.get("main", {}).get("humidity", 75),
                        "condition": data.get("weather", [{}])[0].get("main", "Clear"),
                        "source": "OpenWeatherMap Live API",
                    }
        except Exception as e:
            print(f"Weather API fetch failed, falling back to local station estimate: {e}")

    # Fallback based on proximity to East Khasi Hills landmarks
    # Cherrapunji is southern (lat ~25.27), Shillong is central (lat ~25.57)
    if lat < 25.35:
        station = DEFAULT_NER_WEATHER["Cherrapunji"]
    elif lat > 25.7:
        station = DEFAULT_NER_WEATHER["Nongpoh"]
    elif lng > 91.9:
        station = DEFAULT_NER_WEATHER["Dawki"]
    else:
        station = DEFAULT_NER_WEATHER["Shillong"]

    return {
        "rainfall_mm": station["rainfall_mm"],
        "temp_c": station["temp_c"],
        "humidity": station["humidity"],
        "condition": station["condition"],
        "source": "NER Ground Station Model (Fallback)",
    }
